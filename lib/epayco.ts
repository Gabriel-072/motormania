// lib/epayco.ts
const epayco = require('epayco-sdk-node')({
    apiKey: 'ca1349c5d0f8f59325e82d2aac8097a6', // PUBLIC_KEY
    privateKey: 'fb92ac8e9374f79e6c4e93fad23729d7', // PRIVATE_KEY
    lang: 'ES',
    test: true, // Set to false in production
});

export default epayco;