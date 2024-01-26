import auth from './auth.js'

export default {

    config: {

        user: auth.user,
        password: auth.password,
        database: 'uniret',
        server: auth.server,
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        },
        options: {
            encrypt: true, // for azure
            trustServerCertificate: true // change to true for local dev / self-signed certs
        }
    }

}
