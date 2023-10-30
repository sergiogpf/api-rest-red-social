//Importar modelo
const Follow = require("../models/follow")
const User = require("../models/user")

//Importar servicio
const followService = require("../services/followService")

//Importar dependencias
const mongoosePaginate = require("mongoose-pagination")

//Acciones de prueba 
const pruebaFollow = (req, res) => {
    return res.status(200).send({
        messge: "Mensaje enviado desde: controllers/follow.js"
    })
}
const save = async (req, res) => {
    try {
        // Conseguir datos por body
        const params = req.body;

        // Sacar id del usuario identificado
        const identity = req.user;

        // Crear objeto con modelo follow
        const userToFollow = new Follow({
            user: identity.id,
            followed: params.followed,
        });

        // Guardar objeto en base de datos
        const followStored = await userToFollow.save();

        if (!followStored) {
            return res.status(500).send({
                status: "error",
                message: "No se ha podido seguir al usuario",
            });
        }

        return res.status(200).send({
            status: "success",
            identity: req.user,
            follow: followStored,
        });
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error al seguir al usuario",
        });
    }
};

const unfollow = async (req, res) => {
    try {
        // Recoger id del usuario identificado
        const userId = req.user.id;

        // Recoger id del usuario que sigo y quiero dejar de seguir
        const followedId = req.params.id;

        // Buscar las coincidencias y hacer remove
        const followDeleted = await Follow.findOneAndDelete({
            user: userId,
            followed: followedId,
        });

        if (!followDeleted) {
            return res.status(404).send({
                status: "error",
                message: "No se encontró el follow para eliminar",
            });
        }

        return res.status(200).send({
            status: "success",
            message: "Follow eliminado correctamente",
            identity: req.user,
            followDeleted
        });
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error al dejar de seguir al usuario",
        });
    }
};

const following = async (req, res) => {
    try {
        // Sacar id del usuario identificado
        let userId = req.user.id;

        // Comprobar si me llega el id por parámetro en la URL
        if (req.params.id) userId = req.params.id;

        // Comprobar si me llega la página, si no llega, será la página 1
        let page = 1;

        if (req.params.page) page = req.params.page;

        // Usuarios por página que quiero mostrar
        let itemsPerPage = 5;

        // Encontrar los follows, popular los datos de los usuarios y paginar con mongoose pagination
        const follows = await Follow.find({ user: userId })
            .populate("user followed", "-password -email -role -__v")
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage);

        const total = await Follow.countDocuments({ user: userId });

        //Sacar array de id de los usuarios que me siguen y los que sigo como el usuario identificado desde la lista de otro usuario
        let followUserIds = await followService.followUserIds(req.user.id)

        return res.status(200).send({
            status: "success",
            message: "Listado de usuarios seguidos",
            follows,
            total,
            pages: Math.ceil(total / itemsPerPage),
            user_following: followUserIds.following,
            user_follow_me: followUserIds.followers
        });
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error al obtener el listado de usuarios seguidos",
        });
    }
};


//Acción listado de usuarios que siguen a cualquier otro usuario
const followers = async(req, res) => {

    try {
        // Sacar id del usuario identificado
        let userId = req.user.id;

        // Comprobar si me llega el id por parámetro en la URL
        if (req.params.id) userId = req.params.id;

        // Comprobar si me llega la página, si no llega, será la página 1
        let page = 1;

        if (req.params.page) page = req.params.page;

        // Usuarios por página que quiero mostrar
        let itemsPerPage = 5;

        // Encontrar los follows, popular los datos de los usuarios y paginar con mongoose pagination
        const follows = await Follow.find({ followed: userId })
            .populate("user", "-password -email -role -__v")
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage);

        const total = await Follow.countDocuments({ user: userId });

        let followUserIds = await followService.followUserIds(req.user.id)

        return res.status(200).send({
            status: "success",
            message: "Listado de usuarios seguidores",
            follows,
            total,
            pages: Math.ceil(total / itemsPerPage),
            user_following: followUserIds.following,
            user_follow_me: followUserIds.followers
        });
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error al obtener el listado de usuarios seguidores",
        });
    }
}


//Exportar acciones
module.exports = {
    pruebaFollow,
    save,
    unfollow,
    following,
    followers
}