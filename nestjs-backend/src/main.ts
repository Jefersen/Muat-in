import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // Create NestJS app instance
  const app = await NestFactory.create(AppModule);

  // Enable Cross-Origin Resource Sharing (CORS) for external integration
  app.enableCors();

  // Enable global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // strips away keys that do not have decorators in the DTO
    transform: true, // automatically typecasts parameters
  }));

  // Configure Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Muat-In API Gateway')
    .setDescription('REST API for CRUD master data, digital manifests, and load planning optimization')
    .setVersion('1.0.0')
    .addBearerAuth() // supports JWT authorization headers
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Set listener port
  const port = process.env.PORT || 3000;
  console.log(`Muat-In backend REST API running on port: ${port}`);
  console.log(`API Swagger documentation available at: http://localhost:${port}/docs`);
  
  await app.listen(port);
}
bootstrap();
