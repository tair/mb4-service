// import * as projectService from '../services/projects-service'
// import * as projectDetailService from '../services/project-detail-service'
import * as institutionService from '../services/institution-service.js'
import { models } from '../models/init-models.js'
import { Sequelize } from 'sequelize'
import sequelizeConn from '../util/db.js'


// get all projects from user ?

// get specific project from user ?

// get institutions
export async function fetchProjectInstitutions(req, res)
{
  // get project id ???????????  

  try{
    // attempt to get the project institutions from the query
    const institutions = await institutionService.fetchInstitutions(req.params.projectId)
    res.status(200).json({institutions})
  }catch(e){
    // error case
    console.error('Problem while getting project institutions (controller).',e)
    res.status(500).json({message: 'Error while getting project institutions.',})
  }
  
}

// get all project institutions that exist?

// assign institution to project
export async function assignInstitutionToProject(req, res)
{
  // get project id and institution id
  const projectId = req.params.projectId
  const institutionId = req.body.institutionToAdd

  // check if institution id is valid?
  if(institutionId == null)
    {    
      // else failure
      res.status(404).json({ message: 'Institution is not found' })
      return
    }

  // check if institution id does not exist in project already ( if needs to be checked )
  /*
  if(institutionToAdd.project_id == projectId)
    {
      // else failure
      res.status(404).json({ message: 'Institution already assigned to project'})
    }
  */

  // attempt to add institution to project 
  try{
    const assignment = models.InstitutionsXProject.build({
      project_id: projectId,
      institution_id: institutionId,
    })

    const transaction = await sequelizeConn.transaction()
    await assignment.save({
      transaction,
      user: req.user,
    })

    await transaction.commit()
    const institution = await models.Institution.findByPk(institutionId)
    console.log('first id: %d', institution.institution_id)
    res.status(200).json({ institution })  

  } catch(e) {
    // else failure
    console.error(e)
    res.status(500).json({message : 'could not assign the two'})
  }   
  
}

// remove institution from project
export async function removeInstitutionFromProject(req, res)
{
  // get project id and institution id
  const projectId = req.params.project_id
  const institutionId = req.body.institutionId

  // check if failure to capture
  if(institutionId == NULL)
  {
    res.status(404).json({ message: 'Institution is not found' })
    return
  }

  // get actual institution
  const institutionToRemove = await models.Institution.findByPk(institutionId)  

  // check for association ** might not need depending on how data is given to user **
  if(institutionToRemove.project_id != projectId)
  {
    res.status(404).json({ message: 'Institution is not associated with the project' })
  }

  // attempt to remove institution id from project
  try{
    console.log()
  }

    // else failure 
}

// code from user-controller.js that will help displaying institutions to choose from
export async function searchInstitutions(req, res) {
  const searchTerm = req.query.searchTerm
  models.Institution.findAll({
    attributes: ['institution_id', 'name'],
    where: {
      name: {
        [Sequelize.Op.like]: '%' + searchTerm + '%',
      },
    },
  })
    .then((institutions) => {
      return res.status(200).json(institutions)
    })
    .catch((err) => {
      console.log(err)
      if (!err.statusCode) {
        err.statusCode = 500
      }
      res
        .status(500)
        .json({ error: 'An error occurred while searching for institutions.' })
    })
}
