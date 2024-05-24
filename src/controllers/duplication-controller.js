import { models } from '../models/init-models.js'
import { Op } from 'sequelize'
import sequelizeConn from '../util/db.js'

export async function createRequest(req, res) {
    const projectId = req.params.projectId
    const message = req.body.message

    try {
        const request = models.ProjectDuplicationRequest.build({
            project_id: projectId,
            request_remarks: message,
            status: 0,
            user_id: req.user,
        })

        const transaction = sequelizeConn.transaction()
        await request.save({
            transaction,
            user: req.user
        })

        await transaction.commit()
        res.status(200).json({message: 'Sucessfully created a duplication request' })
    } catch (e) {
        console.error('Error making duplication request', e)
        res.status(500).json({message: 'Could not create request' })
    }
}

export async function getCondition(req, res) {
    const projectId = req.params.projectId

    // get one time media
        // get all media associated with the project 
            // condtitions .isCopyrighted > 0 and license = 8
    const oneTimeMedia = await models.MediaFile.findAll({
        where: {
            project_id: projectId,
            is_copyrighted: {[Op.gt]: 0},
            copyright_license: 8,
        },
    })

    // get whether the project is published or not
    const project = await models.Project.findByPk(projectId)
    const projectPublished = project.published == 1

    res.status(200).json({oneTimeMedia, projectPublished})

}