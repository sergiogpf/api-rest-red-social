//Importar modulos
const fs = require("fs")
const path = require("path")

//Importar modelos
const Publication = require("../models/publication")

//Importar servicios
const followService = require("../services/followService")
const { error } = require("console")


//Acciones de prueba 
const pruebaPublication = (req, res) => {
    return res.status(200).send({
        messge: "Mensaje enviado desde: controllers/publication.js"
    })
}

const save = async (req, res) => {
    try {
        // Recoger datos del body
        const params = req.body;

        // Si no llegan, respuesta negativa
        if (!params.text) {
            return res.status(400).send({
                status: "error",
                message: "Debes enviar el texto",
            });
        }

        // Crear y rellenar el objeto del modelo
        const newPublication = new Publication(params);
        newPublication.user = req.user.id;

        // Guardar objeto en la base de datos
        const publicationStored = await newPublication.save();

        if (!publicationStored) {
            return res.status(400).send({
                status: "error",
                message: "No se ha guardado la publicación",
            });
        }

        // Devolver respuesta
        return res.status(200).send({
            status: "success",
            message: "Publicación guardada",
            publicationStored,
        });
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error al guardar la publicación",
        });
    }
};

const detail = async (req, res) => {
    try {
        // Sacar id de publicación de la URL
        const publicationId = req.params.id;

        // Buscar la publicación por su ID
        const publicationStored = await Publication.findById(publicationId);

        if (!publicationStored) {
            return res.status(404).send({
                status: "error",
                message: "No existe la publicación",
            });
        }

        // Devolver respuesta
        return res.status(200).send({
            status: "success",
            message: "Mostrar publicación",
            publication: publicationStored,
        });
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error al buscar la publicación",
        });
    }
};

const remove = async (req, res) => {
    try {
        // Sacar id de la publicación a eliminar
        const publicationId = req.params.id;

        // Buscar y eliminar la publicación
        const result = await Publication.deleteOne({ user: req.user.id, _id: publicationId });

        if (result.deletedCount === 0) {
            return res.status(404).send({
                status: "error",
                message: "No se ha encontrado la publicación para eliminar",
            });
        }

        // Devolver respuesta
        return res.status(200).send({
            status: "success",
            message: "Eliminar publicación",
            publication: publicationId,
        });
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error al eliminar la publicación",
        });
    }
};

const user = async (req, res) => {
    try {
        // Sacar el id del usuario
        const userId = req.params.id;

        // Controlar la página
        let page = 1;

        if (req.params.page) page = req.params.page;

        const itemsPerPage = 5;

        // Encontrar publicaciones, ordenarlas y paginar
        const publications = await Publication.find({ user: userId })
            .sort({ created_at: -1 }) // Ordenar por fecha de creación descendente
            .populate("user", "-password -__v -role -email")
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage)
            .exec();

        if (!publications || publications.length <= 0) {
            return res.status(404).send({
                status: "error",
                message: "No hay publicaciones para mostrar",
            });
        }

        const total = await Publication.countDocuments({ user: userId });

        // Devolver respuesta
        return res.status(200).send({
            status: "success",
            message: "Publicaciones del perfil de un usuario",
            page,
            total,
            pages: Math.ceil(total / itemsPerPage),
            publications,
        });
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error al obtener las publicaciones del perfil del usuario",
        });
    }
};


//Subir ficheros 
const upload = async (req, res) => {

    //Sacar publicationId
    const publicationId = req.params.id

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

    let publicationUpdated = await Publication.findOneAndUpdate({ "user": req.user.id, "_id": publicationId }, { file: req.file.filename }, { new: true });
    try {
        if (!publicationUpdated) {
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
            publication: publicationUpdated,
            file: req.file
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

//Devolver archivos multimedia/imagenes
const media = (req, res) => {

    //Sacar el parametro de la url
    const file = req.params.file

    //Montar el path real de la imagen
    const filePath = "./uploads/publications/" + file

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

const feed = async (req, res) => {
    try {
        // Sacar la página actual
        let page = 1;

        if (req.params.page) page = req.params.page;

        // Número de elementos por página
        let itemsPerPage = 5;

        // Sacar array de identificadores de usuarios que sigo como usuario identificado
        const myFollows = await followService.followUserIds(req.user.id);

        // Encontrar publicaciones, ordenarlas y paginar
        const publications = await Publication.find({ user: { $in: myFollows.following } })
            .populate("user", "nick image name surname")
            .sort({ created_at: -1 })
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage)
            .exec();

        if (!publications || publications.length === 0) {
            return res.status(500).send({
                status: "error",
                message: "No hay publicaciones para mostrar",
            });
        }

        const total = await Publication.countDocuments({ user: { $in: myFollows.following } });

        // Devolver respuesta
        return res.status(200).send({
            status: "success",
            message: "Feed de publicaciones",
            following: myFollows.following,
            total,
            page,
            pages: Math.ceil(total / itemsPerPage),
            publications,
        });
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "No se han listado las publicaciones del feed",
        });
    }
};




//Exportar acciones
module.exports = {
    pruebaPublication,
    save,
    detail,
    remove,
    user,
    upload,
    media,
    feed
}