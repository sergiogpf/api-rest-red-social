//Importar dependencias y módulos
const bcrypt = require("bcrypt")
const mongoosePagination = require("mongoose-pagination")
const fs = require("fs")
const path = require("path")

//Importar modelos
const User = require("../models/user")
const Follow = require("../models/follow")
const Publication = require("../models/publication")

//Importar servicios
const jwt = require("../services/jwt")
const { use } = require("../routes/user")
const followService = require("../services/followService")

//Acciones de prueba 
const pruebaUser = (req, res) => {
    return res.status(200).send({
        messge: "Mensaje enviado desde: controllers/user.js",
        usuario: req.user
    })
}

//Registro de usuarios
const register = (req, res) => {
    //Recoger datos de la petición
    let params = req.body

    //Comprobar que llegan bien y validación
    if (!params.name || !params.email || !params.password || !params.nick) {
        console.log("Validación incorrecta")
        return res.status(400).json({
            status: "error",
            message: "Faltan datos por enviar",
        })
    }

    //Crear objeto de usuario
    let user_to_save = new User(params)

    //Control usuarios duplicados
    User.find({
        $or: [
            { email: params.email.toLowerCase() },
            { nick: params.nick.toLowerCase() },
        ],
    }).then(async (users) => {
        if (users && users.length >= 1) {
            return res.status(200).send({
                status: "success",
                message: "El usuario ya existe",
            });
        }

        //Cifrar la contraseña
        let pwd = await bcrypt.hash(params.password, 10);
        params.password = pwd;
        //Crear objeto  de usuario
        let user_to_save = new User(params);
        //Guardar usuario en la bdd
        user_to_save.save().then((userStored) => {

            //Devolver el resultado
            return res.status(200).json({
                status: "success",
                message: "Usuario registrado correctamente",
                user: userStored,
            });
        }).catch((error) => {
            return res.status(500).json({ status: "error", message: "Error al guardar el usuario" })
        });


    })
}

const login = async (req, res) => {
    //Recoger parametros body
    let params = req.body

    if (!params.email || !params.password) {
        return res.status(400).send({
            status: "error",
            message: "Faltan datos por enviar",
        })
    }

    //Buscar en base de datos si existe
    try {
        let user = await User.findOne({ email: params.email })
            //    .select({"password": 0})
            .exec()

        if (!user) {
            return res.status(404).send({
                status: "error",
                message: "No existe el usuario",
            });
        }
        //Comprobar su contraseña
        let pwd = bcrypt.compareSync(params.password, user.password)

        if (!pwd) {
            return res.status(404).send({
                status: "error",
                message: "No te has identificado correctamente",
            });
        }

        //Conseguir token
        const token = jwt.createToken(user)

        //Devolver datos usuario

        return res.status(200).send({
            status: "success",
            message: "Acción de login",
            user: {
                id: user._id,
                name: user.name,
                nick: user.nick
            },
            token
        })
    } catch (error) {
        return res.status(404).send({
            status: "error",
            message: "No existe el usuario",
        });
    }

}

const profile = async (req, res) => {
    //Recibir el parametro de id del usuario por la url
    const id = req.params.id

    try {
        //Consulta para sacar los datos del usuario
        const userProfile = await User.findById(id).select({ password: 0, role: 0 })

        if (!userProfile) {
            return res.status(404).send({
                status: "error",
                message: "No existe el usuario",
            });
        }

        //Info de seguimiento
        const followInfo = await followService.followThisUser(req.user.id, id)

        //Devolver el resultado exitoso 
        return res.status(200).send({
            status: "success",
            user: userProfile,
            following: followInfo.following,
            follower: followInfo.follower
        })

    } catch (error) {
        return res.status(404).send({
            status: "error",
            message: "Hay un error en la consulta",
            id
        });
    }


}

const list = async (req, res) => {

    //Controlar en que página estamos
    let page = 1
    if (req.params.page) {
        page = parseInt(req.params.page)
    }

    //Consulta con mongoose para contar el total de usuarios
    const total = await User.countDocuments()


    //Consulta con mongoose paginate
    let itemsPerPage = 5
    let startIndex = (page - 1) * itemsPerPage

    try {
        const users = await User.find()
            .select("-password -email -role -__v")
            .sort('_id')
            .skip(startIndex)
            .paginate(page, itemsPerPage)

        //Sacar array de id de los usuarios que me siguen y los que sigo como el usuario identificado desde la lista de otro usuario
        let followUserIds = await followService.followUserIds(req.user.id)

        //Devolver resultado (posteriormente info de follows)
        return res.status(200).send({
            status: "success",
            users,
            page,
            itemsPerPage,
            total,
            pages: Math.ceil(total / itemsPerPage),
            user_following:  followUserIds.following,
            user_follow_me: followUserIds.followers
        })
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error al obtener usuarios",
            error
        });
    }




}

const update = async (req, res) => {
    try {
        // Recoger info del usuario a actualizar
        const userIdentity = req.user;
        const userToUpdate = req.body;

        // Eliminar campos sobrantes
        delete userToUpdate.iat;
        delete userToUpdate.exp;
        delete userToUpdate.role;
        delete userToUpdate.image;

        // Comprobar si el usuario existe
        const users = await User.find({
            $or: [
                { email: userToUpdate.email.toLowerCase() },
                { nick: userToUpdate.nick.toLowerCase() },
            ],
        });

        const userIsset = users.some((user) => user && user._id != userIdentity.id);

        if (userIsset) {
            return res.status(200).send({
                status: "success",
                message: "El usuario ya existe",
            });
        }

        // Cifrar la contraseña
        if (userToUpdate.password) {
            const pwd = await bcrypt.hash(userToUpdate.password, 10);
            userToUpdate.password = pwd;
        } else {
            delete userToUpdate.password
        }

        // Buscar y actualizar el usuario con la nueva info
        const userUpdated = await User.findByIdAndUpdate(userIdentity.id, userToUpdate, { new: true });

        if (!userUpdated) {
            return res.status(500).json({
                status: "error",
                message: "Error al actualizar usuario",
            });
        }

        // Devolver respuesta
        return res.status(200).send({
            status: "success",
            message: "Método actualizar usuario",
            user: userUpdated
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error al actualizar usuario"
        });
    }
};

const upload = async (req, res) => {

    //Recoger el fichero de imagen y comprobar que existe
    if (!req.file) {
        return res.status(404).send({
            status: "error",
            message: "Petición no incluye la imagen"
        })
    }

    //Conseguir nombre del archivo
    let image = req.file.originalname

    //Sacar extensión archivo
    const imageSplit = image.split("\.")
    const extension = imageSplit[1]

    //Comprobar extensión
    if (extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif") {

        //Borrar archivo subido
        const filePath = req.files.path
        const fileDeleted = fs.unlinkSync(filePath)

        //Respuesta negativa
        return res.status(400).send({
            status: "error",
            message: "Extensión del fichero invalida"
        })
    }

    //Si no es correcta, borrar archivo

    //Si es correcta, guardar imagen en base de datos
    //Si es correcta la extensión, hay que guardar la imagen en la DB

    let userUpdated = await User.findOneAndUpdate({ _id: req.user.id }, { image: req.file.filename }, { new: true });
    try {
        if (!userUpdated) {
            return res.status(500).send({
                status: "error",
                message: "Error en la subida del avatar",
                user: req.user,
                error: error.message
            });
        }

        //Devolver respuesta
        return res.status(200).send({
            status: "success",
            user: userUpdated,
            file: req.file,
        });

    } catch (error) {
        return res.status(400).send({
            status: "error",
            message: "Error en la app",
            user: req.user,
            error: error.message
        });
    }
}


const avatar = (req, res) => {

    //Sacar el parametro de la url
    const file = req.params.file

    //Montar el path real de la imagen
    const filePath = "./uploads/avatars/" + file

    //Comprobar que existe
    fs.stat(filePath, (error, exists) => {
        if (!exists) {
            return res.status(404).send({
                status: "error",
                message: "No existe la imagen"
            })
        }

        //Devolver un file
        return res.sendFile(path.resolve(filePath))
    })
}

const counters = async (req, res) => {

    let userId = req.user.id

    if(req.params.id){
        userId = req.params.id
    }

    try {
        const following = await Follow.count({"user": userId})
        const followed = await Follow.count({"followed": userId})
        const publications = await Publication.count({"user": userId})

                //Devolver respuesta
                return res.status(200).send({
                    userId,
                    following: following,
                    followed: followed,
                    publications: publications
                });
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error en los contadores"
        });
    }
}




//Exportar acciones
module.exports = {
    pruebaUser,
    register,
    login,
    profile,
    list,
    update,
    upload,
    avatar,
    counters
}