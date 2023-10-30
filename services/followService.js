const follow = require("../models/follow")

const followUserIds = async (identityUserId) => {
    try {

        //Sacar info de seguimiento
        let following = await follow.find({ "user": identityUserId })
            .select({ "followed": 1, "_id": 0 })
            .exec()

        let followers = await follow.find({ "followed": identityUserId })
            .select({ "user": 1, "_id": 0 })
            .exec()

        //Procesar array de identificadores
        let followingClean = []

        following.forEach(follow => {
            followingClean.push(follow.followed)
        })

        let followersClean = []

        followers.forEach(follow => {
            followersClean.push(follow.user)
        })

        return {
            following: followingClean,
            followers: followersClean
        }

    } catch (error) {
        return {}
    }
}

const followThisUser = async (identityUserId, profileUserId) => {
    //Sacar info de seguimiento
    let following = await follow.findOne({ "user": identityUserId, "followed": profileUserId })
    
    let follower = await follow.findOne({ "user": profileUserId, "followed": identityUserId })

        return {
            following,
            follower
        }

}

module.exports = {
    followUserIds,
    followThisUser
}