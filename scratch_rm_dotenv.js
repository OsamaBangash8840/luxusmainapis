const fs = require('fs');
const files = [
    'scripts/migrateOwnerToSeller.js',
    'scripts/createAdmin.js',
    'routes/userRoutes.js',
    'routes/schedulaTourRoutes.js',
    'routes/contactForm.js',
    'middlewares/verifyToken.js',
    'middlewares/socketsToken.js',
    'middlewares/adminAuth.js',
    'helpers/auth.helper.js',
    'controllers/scheduleTour.controller.js',
    'controllers/auth.controller.js',
    'controllers/admin.controller.js',
    'config/emailTransporter.js',
    'config/db.js',
    'app.js'
];
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/require\(['"]dotenv['"]\)\.config\(\);\r?\n?/g, '');
    fs.writeFileSync(f, content);
});
