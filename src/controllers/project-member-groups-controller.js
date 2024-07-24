import * as service from '../services/project-member-groups-service.js'

export async function getProjectGroups(req, res) {
  const projectId = req.params.projectId
  try {
    const groups = await service.getGroupsInProject(projectId)
    res.status(200).json({
      groups: groups.map((row) => convertGroup(row)),
    })
  } catch (err) {
    console.error(`Error: Cannot fetch member groups for ${projectId}`, err)
    res.status(500).json({ message: 'Error while fetching member groups.' })
  }
}

export async function getGroupsMembership(req, res) {
  const projectId = req.params.projectId
  const membershipId = req.params.linkId
  try {
    const groups = await service.getGroupsInProject(projectId)
    const groups_joined = await service.getGroupsForMember(membershipId)
    res.status(200).json({
      groups_membership: convertGroupsJoined(groups, groups_joined),
    })
  } catch (err) {
    console.error(`Error: Cannot fetch member groups for member ${membershipId}`, err)
    res.status(500).json({ message: 'Error while fetching member groups.' })
  }
}

function convertGroupsJoined(groups, groups_joined) {
  const groups_membership = []
  while(groups.length>0) {//might need an improvement in efficiency below its slight
    let pushed = false
    let i = 0
    // groups{a,b,d,e,f,g}
    // joined{b,d,g,a}
    while(groups_joined.length>i) {
      if(groups_joined[i].group_id == groups[0].group_id){
        groups_membership.push(groupsJoinedHelper(groups[0], groups_joined[i]))
        pushed = true
        break
      }
      i++
    }
    if(!pushed) {
      groups_membership.push(groupsJoinedHelper(groups[0], null))
    } else {
      groups_joined.splice(i,1)
    }
    groups.shift()
  }

  return groups_membership
}

function groupsJoinedHelper(group, group_joined) {
  if(group_joined) {
    return {
      joined: (group.group_id == group_joined.group_id) ? 1 : 0,
      group_name: group.group_name,
      group_id: parseInt(group.group_id),
    }
  } else {
    return {
      joined: 0,
      group_name: group.group_name,
      group_id: parseInt(group.group_id),
    }
  }
}

function convertGroup(row) {
  return {
    group_id: parseInt(row.group_id),
    group_name: row.group_name,
    description: row.description,
  }
}
