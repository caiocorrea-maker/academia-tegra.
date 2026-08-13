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

// Upload de foto de perfil (carteirinha) — mesmas regras de tipo, sem limite de tamanho
// (a imagem é comprimida no backend antes de subir ao bucket).
const uploadFoto = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!tiposPermitidos.includes(file.mimetype)) {
      return cb(new Error('Apenas arquivos PNG ou JPG são permitidos para a foto de perfil.'));
    }
    cb(null, true);
  },
});

// Upload de material da Biblioteca de Treinamentos — apenas PDF ou PPT/PPTX, até 20MB.
const uploadMaterial = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = [
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    if (!tiposPermitidos.includes(file.mimetype)) {
      return cb(new Error('Apenas arquivos PDF ou PPT/PPTX são permitidos na Biblioteca de Treinamentos.'));
    }
    cb(null, true);
  },
});

module.exports = upload;
module.exports.uploadFoto = uploadFoto;
module.exports.uploadMaterial = uploadMaterial;
