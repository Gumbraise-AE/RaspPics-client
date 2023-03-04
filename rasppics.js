require('dotenv').config();
const schedule = require('node-schedule');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const PiCamera = require('pi-camera');
const {createCanvas, loadImage} = require('canvas');
const {exec} = require('child_process');
const sensor = require('node-dht-sensor');

// Définir le type de capteur (DHT11) et le pin GPIO utilisé pour la connexion
const sensorType = 11;
const pin = 4;

let temp = 22;
let hum = 5;

// Lire les données de température et d'humidité
const job = schedule.scheduleJob('*/15 * * * * *', () => {
    sensor.read(sensorType, pin, (err, temperature, humidity) => {
        if (!err) {
            temp = `Temp. : ${temperature}°C`;
            hum = `Hum. : ${humidity}%`;
        } else {
            console.log(`Echec de la lectured ela température et de l'humidité. Réessayer !`);
        }
    });

    exec('systemctl --user stop fmp4streamer');

    setTimeout(() => {
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
                const str = `${dateStr} • ${temp} • ${hum}`
                const textWidth = context.measureText(str).width;
                context.strokeStyle = "#000";
                context.lineWidth = 4;
                context.strokeText(str, image.width - textWidth - 10, image.height - 20);
                context.fillStyle = '#fff';
                context.fillText(str, image.width - textWidth - 10, image.height - 20);

                // Enregistrer l'image modifiée
                const out = fs.createWriteStream(imagePath);
                const stream = canvas.createJPEGStream({
                    quality: 0.95, chromaSubsampling: true
                });
                stream.pipe(out);

                setTimeout(() => {
                    exec('systemctl --user start fmp4streamer');
                }, 2000);

                out.on('finish', () => {
                    const formData = new FormData();
                    const imageStream = fs.createReadStream(imagePath);
                    formData.append('rasp_pic[picFile]', imageStream);

                    axios({
                        method: 'post', url: 'http://192.168.1.16:8000/api/rasp-pic', data: formData, headers: {
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
    }, 2000);
});
