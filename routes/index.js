const Pet = require('../models/pet');

module.exports = (app) => {
    app.get('/', (req, res) => {
        const page = req.query.page || 1

        Pet.paginate({}, {page: page}).then(results => {
            if (req.header('Content-Type') === 'application/json')
                return res.json({pets: results.docs, pagesCount: results.pages, currentPage: page});

            res.render('pets-index', {pets: results.docs, pagesCount: results.pages, currentPage: page});
        });
    });
}
