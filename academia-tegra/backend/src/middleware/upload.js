const multer = require('multer');

// Armazena em memória; o buffer é então enviado ao bucket S3-compatível.
// Sem limite de tamanho/quantidade de arquivos, conforme especificação.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!tiposPermitidos.includes(file.mimetype)) {
      return cb(new Error('Apenas arquivos PNG ou JPG são permitidos para evidências.'));
    }
    cb(null, true);
  },
});

module.exports = upload;
