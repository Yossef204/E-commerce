export default () => ({
  port: parseInt(process.env.PORT as string) || 3000,
  database: {
    url: process.env.DB_URL as string,
    email: process.env.DB_EMAIL as string,
    password: process.env.DB_PASSWORD as string,
    cluster: process.env.DB_CLUSTER as string,
  },
  encryption: {
    secret: process.env.SECRET_KEY_ENCRYPTION as string,
  },
  mail: {
    email: process.env.EMAIL as string,
    password: process.env.PASSWORD_EMAIL_NODEMAILER as string,
    host: process.env.MAIL_HOST as string,
    port: process.env.MAIL_PORT || 456,
  },
  s3: {
    access: process.env.S3_ACCESS_KEY as string,
    secret: process.env.S3_SECRET_ACCESS_KEY as string,
    bucket: process.env.S3_BUCKET_NAME as string,
    region: process.env.S3_REGION as string,
  },
  jwt: {
    accessSecret: process.env.ACCESS_TOKEN_SECRET as string,
  },
  cache: {
    host: process.env.REDIS_URL as string,
    port: 6379,
  },
});
