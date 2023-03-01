require('dotenv').config();
const schedule = require('node-schedule');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const PiCamera = require('pi-camera');
const { createCanvas, loadImage } = require('canvas');

const job = schedule.scheduleJob('*/15 * * * * *', function () {
    const imagePath = `${__dirname}/image.jpg`;
    let myCamera = new PiCamera({
        mode: 'photo', output: imagePath, width: 1280, height: 960, nopreview: true,
    });

    myCamera.snap()
        .then(async (result) => {
            // Charger l'image dans Canvas
            const image = await loadImage(imagePath);
            const canvas = createCanvas(image.width, image.height);
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0);

            // Ajouter la date et l'heure en bas à droite
            context.font = '20px Arial';
            context.fillStyle = '#fff';
            const dateStr = new Date().toLocaleString();
            const textWidth = context.measureText(dateStr).width;
            context.fillText(dateStr, image.width - textWidth - 10, image.height - 20);

            // Enregistrer l'image modifiée
            const out = fs.createWriteStream(imagePath);
            const stream = canvas.createJPEGStream({
                quality: 0.95,
                chromaSubsampling: true
            });
            stream.pipe(out);

            out.on('finish', () => {
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
            });
        })
        .catch((error) => {
            console.error('Erreur lors de la prise de la photo :', error);
        });
});
