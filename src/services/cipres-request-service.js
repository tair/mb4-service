import sequelizeConn from '../util/db.js'
import { time } from '../util/util.js'
import config from '../config.js'
import { models } from '../models/init-models.js'
import { QueryTypes } from 'sequelize'
import axios from 'axios'

const URL = config.cipres.url || 'https://cipresrest.sdsc.edu/cipresrest/v1'
// const URL = 'https://bumper.sdsc.edu/cipresrest/v1'
const CRA_USER = config.cipres.username 
const PASSWORD = config.cipres.password 
const KEY = config.cipres.key 
const CRE = btoa(`${CRA_USER}:${PASSWORD}`)

export default class CipresRequestService {
  static async createCipresRequest( matrixId, userIn, notesIn, jobnameIn, cipresSettings, paramsIn) {
    const response = await CipresRequestService.submitCipresJob(paramsIn)
    if (response != null) {
      let formDataForSubmission = {
        matrix_id: matrixId,
        user_id: userIn?.user_id,
        notes: notesIn,
        created_on: time(),
        cipres_job_id: response.jobHandle,
        cipres_tool: paramsIn['tool'],
        cipres_last_status: response.jobStage,
        jobname: jobnameIn,
        cipres_settings: cipresSettings,
      }
      try {
        const request = await models.CipresRequest.build(formDataForSubmission)
        const transaction = await sequelizeConn.transaction()
        await request.save({ user: userIn, transaction: transaction })
        await transaction.commit()
        return {message: `Your job ${jobnameIn} has been submitted to CIPRES`}
      }
      catch (error) {
        console.error(error)
      }
    }
    return {message: `Failed to submit your job ${jobnameIn} to CIPRES`}
  }

  static async deleteCipresRequest( matrixId, userIn, jobNameIn, cipresJobId) {
    const response = await CipresRequestService.deleteCipresJob(cipresJobId)
    if (response != null && !(response.includes("Fail") || response.includes("fail"))) {
      try {
        const transaction = await sequelizeConn.transaction()
        await models.CipresRequest.destroy({
          where: {
            matrix_id: matrixId,
            user_id: userIn?.user_id,
            cipres_job_id: cipresJobId,
            jobname: jobNameIn,
          },
          transaction: transaction,
          user: userIn,
        })

        await transaction.commit()
        return {message: `Your job ${jobNameIn} has been deleted`}
      }
      catch (error) {
        console.error(error)
      }
    }
    return {message: `Failed to delete your job ${jobNameIn}`}
  }

  static async getCipresJobs(matrixIds, userId) {
    const [rows] = await sequelizeConn.query(
    `   
        SELECT request_id, matrix_id, user_id, jobname, FROM_UNIXTIME(created_on, '%Y-%m-%d %H:%i:%s GMT') created_on,  cipres_job_id, cipres_tool, cipres_last_status, cipres_settings, notes, '${URL}' as cu, '${KEY}' as ck, '${CRE}' as cr, '${CRA_USER}' as ca
        FROM cipres_requests
        WHERE matrix_id IN (?) and user_id = ? order by created_on desc`,
       { replacements: [matrixIds, userId] }
    )
    return rows
  }

  static async syncCipresJobs() {
    const [rows] = await sequelizeConn.query(
    `   
        SELECT request_id, cipres_job_id
        FROM cipres_requests
        WHERE cipres_job_id is not null and cipres_job_id like 'NGBW%'and cipres_last_status not IN ('COMPLETED', 'EXPIRED') order by created_on desc`,
    )
    const transaction = await sequelizeConn.transaction()
    for (const row of rows) {
      let jobHandle = row.cipres_job_id
      let jobStage = ''
      try {
        jobStage = await CipresRequestService.getCipresJobStage(jobHandle) 
        // if (jobStage == null || jobStage == '')
        //  jobStage = 'EXPIRED'
        console.log("Job status is: " + jobStage + " row.request_id = " + row.request_id + " jobHandle = " + jobHandle)
        if (jobStage != null && jobStage != '') {
          try {
          const [, updated] = await sequelizeConn.query(
          `
            UPDATE cipres_requests SET last_updated_on = ?, cipres_last_status = ? WHERE request_id = ? and cipres_job_id = ?`,
            {
              replacements: [time(), jobStage, row.request_id, jobHandle],
              type: QueryTypes.UPDATE,
              transaction: transaction,
            }
          )
          } catch (error) {
            console.error(error)
          }
        }
      } catch (error) {
        // console.log("---Error----------------------------------")
        // console.error(error)
        // console.log("------------------------------------------")
      } finally {
      }
    }
    await transaction.commit()
  }

  static async getCipresJobStage(jobHandle) {
    let jobStage = ''
    try {
      const response = await axios.get(
        `${URL}/job/${CRA_USER}/${jobHandle}`,
        {
            headers: {
              'cipres-appkey':`${KEY}`,
            },
            auth: {
              username: `${CRA_USER}`,
              password: `${PASSWORD}`
            },
          }
        )
      console.log(response.data)
      const js = '<jobStage>'
      jobStage = response.data.substring(response.data.indexOf(js)+js.length, response.data.lastIndexOf('</' + js.slice(1)))
    } catch (error) {
      // console.error(error)
    }
    return jobStage
  }

  static async submitCipresJob(formDataForSubmission) {
    try {
      const response = await axios.post(
        `${URL}/job/${CRA_USER}`,
        formDataForSubmission,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'cipres-appkey':`${KEY}`,
          },
          auth: {
            username: `${CRA_USER}`,
            password: `${PASSWORD}`
          },
        }
      )
      console.log(response.data);
      const jh = '<jobHandle>'
      const jobHandle = response.data.substring(response.data.indexOf(jh)+jh.length, response.data.lastIndexOf('</' + jh.slice(1)))
      const js = '<jobStage>'
      const jobStage = response.data.substring(response.data.indexOf(js)+js.length, response.data.lastIndexOf('</' + js.slice(1)))
      return {'jobHandle': jobHandle, 'jobStage': jobStage}
    } catch (error) {
      console.error(error)
    }
    return null
  }

  static async deleteCipresJob(cipresJobId) {
    try {
      await axios.delete(
        `${URL}/job/${CRA_USER}/${cipresJobId}`,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'cipres-appkey':`${KEY}`,
          },
          auth: {
            username: `${CRA_USER}`,
            password: `${PASSWORD}`
          },
        }
      )
      try {
        const response = await axios.get(
          `${URL}/job/${CRA_USER}/${cipresJobId}`,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'cipres-appkey':`${KEY}`,
            },
            auth: {
              username: `${CRA_USER}`,
              password: `${PASSWORD}`
            },
          }
        )
        return "Failed to delete job " + cipresJobId
      } catch (error) {
        if (error.response?.data?.indexOf("Job Not Found") < 0)
          return "Failed to delete job " + cipresJobId
      }
    } catch (error) {
      //if (error.response?.data != null)
      //  console.error(error.response.data)
      //else
      //  console.error(error)
      if (error.response?.data?.indexOf("Job Not Found") < 0)
      {
        return "Failed to delete job " + cipresJobId
      }
    }
    return "Successfully deleted job " + cipresJobId
  }
}
