import 'dotenv/config';
import app from './app';

const port = Number(process.env.PORT ?? 8000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`DevPath backend listening on port ${port}`);
});
