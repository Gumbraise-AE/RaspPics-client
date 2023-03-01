require('dotenv').config();
const schedule = require('node-schedule');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const PiCamera = require('pi-camera');

const job = schedule.scheduleJob('*/15 * * * * *', function (fireDate) {
    const imagePath = `${__dirname}/image.jpg`;
    let myCamera = new PiCamera({
        mode: 'photo', output: imagePath, width: 1280, height: 960, nopreview: true,
    });

    myCamera.snap()
        .then((result) => {
            const formData = new FormData();
            const imageStream = fs.createReadStream(imagePath);
            formData.append('rasp_pic[picFile]', imageStream);

            axios({
                method: 'post',
                url: 'http://192.168.1.16:8000/api/rasp-pic',
                data: formData,
                headers: {
                    ...formData.getHeaders(),
                    'Content-Type': 'multipart/form-data',
                    'Authorization': process.env.TOKEN
                }
            }).then(response => {
                console.log(response.data);
            }).catch(error => {
                console.error('Erreur lors de l\'envoi du fichier :', error);
            });
        })
        .catch((error) => {
            console.error('Erreur lors de la prise de la photo :', error);
        });
});
