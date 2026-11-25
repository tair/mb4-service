#!/usr/bin/env bash
# Forced command for curators' restricted SSH keys (see plugins/mb4-contribute/README.md in tair/phx-curator-skills):
#   restrict,command="bash /home/ec2-user/mb4-project/mb4-service/scripts/curator-ops/curator-ops.sh <curator>" ssh-ed25519 AAAA...
# The remote command line is split into words and matched against the verbs in main();
# it is never passed to a shell. Written for bash 4.2 (Amazon Linux 2), so no `set -u`.
set -f -o pipefail

CONTAINER="${CURATOR_OPS_CONTAINER:-mb4-service-container-prod}"
HELPER="scripts/curator-ops/curator-ops.js" # path inside the container (WORKDIR /app)
STATE_DIR="$HOME/curator-ops"
JOBS_DIR="$STATE_DIR/jobs"
LOCK_DIR="$STATE_DIR/export.lock"
AUDIT_LOG="$STATE_DIR/audit.log"
MAX_IDS=5
WAIT_LIMIT_SECONDS=2400
SCRIPT="$(readlink -f "$0")"
CURATOR=unknown

usage() {
  cat <<'EOF'
MorphoBank curator operations. Commands:
  help              this list
  check <ids>       look up projects before exporting, e.g. check 494,4515
  export <ids>      build the full data ZIP of up to 5 published projects and share it publicly
  status [job]      where an export job is (the latest one if no job is given)
  wait [job]        follow an export job until it ends (gives up after 40 minutes)
  list              the project ZIPs that are currently shared
  remove <id>       take one project's shared ZIP down
EOF
}

audit() { printf '%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$CURATOR" "$*" >> "$AUDIT_LOG"; }

fail() { echo "ERROR: $*" >&2; exit 2; }

helper() { docker exec "$CONTAINER" node "$HELPER" "$@"; }

# Accepts "494,4515", "494 4515" or "P494"; sets IDS to "494,4515".
parse_ids() {
  local raw="$*" id seen=" " out=()
  for id in ${raw//,/ }; do
    id="${id#[Pp]}"
    [[ "$id" =~ ^[0-9]{1,7}$ ]] || fail "\"$id\" is not a project number. Use digits, e.g. 494 or P494."
    [[ "$seen" == *" $id "* ]] && continue
    seen+="$id "
    out+=("$id")
  done
  (( ${#out[@]} )) || fail "Give at least one project number, e.g. 494 or 494,4515."
  (( ${#out[@]} <= MAX_IDS )) || fail "At most $MAX_IDS projects per export. Larger batches go to the tech team."
  IDS="$(IFS=,; echo "${out[*]}")"
}

# One export at a time: each one holds a whole project ZIP in the live service container's memory.
take_lock() {
  mkdir "$LOCK_DIR" 2>/dev/null && return 0
  local job pid
  job="$(cat "$LOCK_DIR/job" 2>/dev/null)"
  pid="$(cat "$JOBS_DIR/$job.pid" 2>/dev/null)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "Another export is running (job $job). Follow it with: wait $job"
    return 1
  fi
  if [ -z "$job" ] && [ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin -2 2>/dev/null)" ]; then
    echo "Another export is starting. Try again in a minute."
    return 1
  fi
  rm -rf "$LOCK_DIR" && mkdir "$LOCK_DIR"
}

start_export() {
  parse_ids "$@"
  take_lock || exit 3
  if ! helper info --require-exportable "$IDS"; then
    rm -rf "$LOCK_DIR"
    echo "Nothing was exported."
    exit 3
  fi
  local job
  job="$(date -u +%Y%m%d-%H%M%S)-$CURATOR"
  echo "$job" > "$LOCK_DIR/job"
  setsid nohup bash "$SCRIPT" --job "$job" "$IDS" "$CURATOR" > "$JOBS_DIR/$job.log" 2>&1 < /dev/null &
  audit "started job $job: $IDS"
  echo "Started export job $job for projects $IDS."
  echo "Follow it with: wait $job"
}

# Runs detached from the SSH session, so a dropped connection doesn't stop the export.
run_job() {
  local job="$1" ids="$2" id out url failed=()
  CURATOR="$3"
  echo $$ > "$JOBS_DIR/$job.pid"
  trap 'rm -rf "$LOCK_DIR"' EXIT
  echo "Job $job: projects $ids, started $(date -u +%FT%TZ)"
  for id in ${ids//,/ }; do
    echo "--- P$id: building the ZIP"
    if ! docker exec "$CONTAINER" npm run --silent upload:sdd -- --project-id="$id"; then
      echo "FAILED P$id: the export script reported an error (see above)."
      failed+=("$id")
      continue
    fi
    echo "--- P$id: sharing"
    if ! out="$(helper share "$id")"; then
      echo "$out"
      echo "FAILED P$id: could not copy the ZIP to the public bucket."
      failed+=("$id")
      continue
    fi
    echo "$out"
    url="$(printf '%s\n' "$out" | awk '$1 == "SHARED" { print $3 }')"
    if [ -z "$url" ] || ! curl -sfI --max-time 30 "$url" > /dev/null; then
      echo "FAILED P$id: the shared link ${url:-(none)} does not answer publicly."
      failed+=("$id")
      continue
    fi
    echo "RESULT P$id $url"
  done
  echo "Finished $(date -u +%FT%TZ)"
  if (( ${#failed[@]} )); then
    audit "job $job failed for: ${failed[*]}"
    echo "FAILED"
    exit 1
  fi
  audit "job $job done: $ids"
  echo "DONE"
}

pick_job() {
  local job="$1"
  if [ -z "$job" ]; then
    job="$(ls -1t "$JOBS_DIR" 2>/dev/null | sed -n 's/\.log$//p' | head -n 1)"
    [ -n "$job" ] || fail "There are no export jobs yet."
  fi
  [[ "$job" =~ ^[0-9]{8}-[0-9]{6}-[a-z0-9_-]+$ ]] || fail "\"$job\" is not a job name."
  [ -f "$JOBS_DIR/$job.log" ] || fail "There is no job called $job."
  JOB="$job"
}

# running | done | failed | stopped (the process ended without finishing, e.g. a server restart)
job_state() {
  local log="$JOBS_DIR/$JOB.log" pid
  grep -qx DONE "$log" && { echo done; return; }
  grep -qx FAILED "$log" && { echo failed; return; }
  pid="$(cat "$JOBS_DIR/$JOB.pid" 2>/dev/null)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then echo running; else echo stopped; fi
}

show_status() {
  pick_job "$1"
  local state
  state="$(job_state)"
  echo "Job $JOB: $state"
  grep -E '^(RESULT|FAILED) ' "$JOBS_DIR/$JOB.log"
  if [ "$state" != done ]; then
    echo "--- last lines of the job log:"
    tail -n 15 "$JOBS_DIR/$JOB.log"
  fi
}

wait_job() {
  pick_job "$1"
  local log="$JOBS_DIR/$JOB.log" shown=0 total state waited=0
  while :; do
    total=$(wc -l < "$log")
    if (( total > shown )); then
      sed -n "$((shown + 1)),${total}p" "$log" | grep -E '^(Job |--- |SHARED |RESULT |FAILED|Finished )|✅|❌|📤'
      shown=$total
    fi
    state="$(job_state)"
    [ "$state" = running ] || break
    if (( waited >= WAIT_LIMIT_SECONDS )); then
      echo "Still running after $((WAIT_LIMIT_SECONDS / 60)) minutes. Check again with: wait $JOB"
      exit 4
    fi
    sleep 15
    waited=$((waited + 15))
  done
  echo "Job $JOB: $state"
  [ "$state" = done ]
}

main() {
  if [ "$1" = "--job" ]; then
    shift
    run_job "$@"
    exit $?
  fi
  [[ "$1" =~ ^[a-z0-9_-]{1,32}$ ]] && CURATOR="$1"
  mkdir -p "$JOBS_DIR"
  local args=() verb
  read -r -a args <<< "$SSH_ORIGINAL_COMMAND"
  verb="${args[0]:-help}"
  audit "${args[*]:-help}"
  case "$verb" in
    help | --help | -h) usage ;;
    check) parse_ids "${args[@]:1}"; helper info "$IDS" ;;
    export) start_export "${args[@]:1}" ;;
    status) show_status "${args[1]}" ;;
    wait) wait_job "${args[1]}" ;;
    list) helper list ;;
    remove)
      parse_ids "${args[@]:1}"
      [[ "$IDS" != *,* ]] || fail "Remove one project at a time."
      helper unshare "$IDS"
      ;;
    *)
      echo "Unknown command: $verb" >&2
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
