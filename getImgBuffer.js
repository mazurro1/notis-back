const {Buffer} = require('buffer')

const getImgBuffer = (base64) => {
    const base64str = base64.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64str, 'base64');
}

module.exports = getImgBuffer;