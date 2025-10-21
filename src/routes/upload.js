import multer from 'multer'

const storage = multer.diskStorage({})
// Increase field size limits to accommodate large serialized matrix JSON
const upload = multer({ 
  storage: storage,
  limits: {
    fieldSize: 50 * 1024 * 1024, // 50MB per non-file field
    fields: 50,                  // generous number of fields
    fileSize: 500 * 1024 * 1024, // 500MB file size (uploaded NEXUS/TNT)
  }
})

export { upload }
