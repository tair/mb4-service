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
  const projectId = req.params.projectId
  const institutionName = req.body.institutionName
  const institution = await models.Institution.findOne({ where: {name: institutionName}  })

  // check if failure to capture
  if(institution == null)
  {
    res.status(404).json({ message: 'Institution is not found' })
    return
  }

  /*// get actual institution
  const institutionToRemove = await models.Institution.findByPk(institutionId)  

  // check for association ** might not need depending on how data is given to user **
  if(institutionToRemove.project_id != projectId)
  {
    res.status(404).json({ message: 'Institution is not associated with the project' })
  }
  */

  // attempt to remove institution id from project
  const transaction = await sequelizeConn.transaction()
  try{
    await models.InstitutionsXProject.destroy({
      where: {
              project_id: projectId,
              institution_id: institution.institution_id
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })

    await transaction.commit()
    res.status(200).json({ institutionName })
    
  }catch(e){
    // else failure 
    await transaction.rollback()
    res.status(404).json({message : "could not remove association"})
    console.log("error removing association", e)

  }    
}

// modified code from user-controller that will aid in presenting available institutions to user
export async function searchInstitutions(req, res) {
  const searchTerm = req.query.searchTerm
  const projectId = req.params.projectId

  try{
    // get way to access all institutions associated with this project 
    const projectInstitutions =  await models.InstitutionsXProject.findAll({ 
      attributes: ['institution_id'],
      where: {project_id: projectId},
    })

    // extract ids because sequelize expects values not objects
    const dupes = projectInstitutions.map(instu => instu.institution_id)

    // get all institutions with like name segment and not within other model
    const institutions = await models.Institution.findAll({ 
      attributes: ['institution_id', 'name'], 
      where: {
        name: { [Sequelize.Op.like]: '%' + searchTerm + '%',},
        institution_id : { [Sequelize.Op.notIn]: dupes },
      },
    })      

    return res.status(200).json(institutions)

  } catch (e) {
      res.status(500).json({message: "error obtaining list of insititutions" })
      console.log('error obtaining list of insititutions', e)
  }
}
