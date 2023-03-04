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

console.info("[RASPPICS] Lancement de l'application");

// Lire les données de température et d'humidité
const job = schedule.scheduleJob('0/30 * * * *', (fireDate) => {
    sensor.read(sensorType, pin, (err, temperature, humidity) => {
        if (!err) {
            temp = `Temp. : ${temperature}°C`;
            hum = `Hum. : ${humidity}%`;

            console.log(`[RASPPICS] [${fireDate}] DHT11 : réussi`);
        } else {
            console.warn(`[RASPPICS] [${fireDate}] DHT11 : échec`);
        }
    });

    exec('systemctl --user stop fmp4streamer');
    console.info(`[RASPPICS] [${fireDate}] Fermeture de fmp4streamer`);

    setTimeout(() => {
        const imagePath = `${__dirname}/image.jpg`;
        let myCamera = new PiCamera({
            mode: 'photo', output: imagePath, width: 1280, height: 960, nopreview: true,
        });

        console.info(`[RASPPICS] [${fireDate}] Prise de la photo`);

        myCamera.snap()
            .then(async (result) => {
                console.log(`[RASPPICS] [${fireDate}] Photo : réussi`);

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

                console.log(`[RASPPICS] [${fireDate}] Ajout éléments sur la photo : réussi`);

                setTimeout(() => {
                    exec('systemctl --user start fmp4streamer');
                    console.info(`[RASPPICS] [${fireDate}] Relancement de fmp4streamer`);
                }, 2000);

                out.on('finish', () => {
                    const formData = new FormData();
                    const imageStream = fs.createReadStream(imagePath);
                    formData.append('rasp_pic[picFile]', imageStream);

                    console.info(`[RASPPICS] [${fireDate}] Envoi de la photo au serveur`);

                    axios({
                        method: 'post', url: 'http://rasppics.gumbraise.com/api/rasp-pic', data: formData, headers: {
                            ...formData.getHeaders(),
                            'Content-Type': 'multipart/form-data',
                            'Authorization': process.env.TOKEN
                        }
                    }).then(response => {
                        console.log(`[RASPPICS] [${fireDate}] Envoi de la photo : réussi`);
                    }).catch(error => {
                        console.warn(`[RASPPICS] [${fireDate}] Envoi de la photo : échec`);
                    });
                });
            })
            .catch((error) => {
                console.warn(`[RASPPICS] [${fireDate}] Photo : échec`);
            });
    }, 2000);
});
