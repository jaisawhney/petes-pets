// AWS S3
const multer = require('multer');
const upload = multer({dest: 'uploads/'});
const Upload = require('s3-uploader');

const client = new Upload(process.env.S3_BUCKET, {
    aws: {
        path: 'pets/avatar',
        region: process.env.S3_REGION,
        acl: 'public-read',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    cleanup: {
        versions: true,
        original: true
    },
    versions: [{
        maxWidth: 400,
        aspect: '16:10',
        suffix: '-standard'
    }, {
        maxWidth: 300,
        aspect: '1:1',
        suffix: '-square'
    }]
});

// MODELS
const Pet = require('../models/pet');

const mailer = require('../utils/mailer');

// PET ROUTES
module.exports = (app) => {

    // INDEX PET => index.js

    // NEW PET
    app.get('/pets/new', (req, res) => {
        res.render('pets-new');
    });

    // CREATE PET
    app.post('/pets', upload.single('avatar'), (req, res) => {
        let pet = new Pet(req.body);

        if (req.file) {
            client.upload(req.file.path, {}, (err, versions) => {
                if (err) {
                    console.error(err);
                    return res.status(400).send({err: err});
                }

                /*versions.forEach(image => {
                    let urlArray = image.url.split('-');
                    urlArray.pop();
                    let url = urlArray.join('-');
                    pet.avatarUrl = url;
                });*/

                const urlArray = versions[0].url.split('-');
                urlArray.pop();
                pet.avatarUrl = urlArray.join('-');

                pet.save().then(() => res.send({pet: pet}));
            });
        } else {
            pet.save().then(() => res.send({pet: pet}));
        }
    });

    // SHOW PET
    app.get('/pets/:id', (req, res) => {
        Pet.findById(req.params.id).exec((err, pet) => {
            res.render('pets-show', {pet: pet});
        });
    });

    // EDIT PET
    app.get('/pets/:id/edit', (req, res) => {
        Pet.findById(req.params.id).exec((err, pet) => {
            res.render('pets-edit', {pet: pet});
        });
    });

    // UPDATE PET
    app.put('/pets/:id', (req, res) => {
        Pet.findByIdAndUpdate(req.params.id, req.body)
            .then((pet) => {
                res.redirect(`/pets/${pet._id}`)
            })
            .catch(err => {
                console.log(err);
            });
    });

    // DELETE PET
    app.delete('/pets/:id', (req, res) => {
        Pet.findByIdAndRemove(req.params.id).exec(() => {
            return res.redirect('/')
        });
    });

    // SEARCH PET
    app.get('/search', (req, res) => {
        Pet.find(
            {$text: {$search: req.query.term}},
            {score: {$meta: "textScore"}}
        )
            .sort({score: {$meta: 'textScore'}})
            .limit(20)
            .exec(function(err, pets) {
                if (err) { return res.status(400).send(err) }

                if (req.header('Content-Type') === 'application/json') {
                    return res.json({ pets: pets });
                } else {
                    return res.render('pets-index', { pets: pets, term: req.query.term });
                }
            });
    });

    const stripe = require('stripe')(process.env.PRIVATE_STRIPE_API_KEY);

    //PURCHASE PET
    app.post('/pets/:id/purchase', (req, res) => {
        const token = req.body.stripeToken;

        const petId = req.body.petId || req.params.id;
        Pet.findByIdAndUpdate(petId, {
            purchasedAt: Date.now()
        }).then((pet) => {
            stripe.charges.create({
                amount: pet.price * 100,
                currency: 'usd',
                description: `Purchased ${pet.name}, ${pet.species}`,
                source: token,
            }).then(charge => {
                const user = {
                    email: req.body.stripeEmail,
                    amount: charge.amount / 100,
                    petName: pet.name
                };
                mailer.sendMail(user, req, res);
            }).catch(err => {
                console.log('Error:' + err);
            });
        }).catch(err => {
            console.log('Error: ' + err);
            res.redirect(`/pets/${req.params.id}`);
        });
    });
}