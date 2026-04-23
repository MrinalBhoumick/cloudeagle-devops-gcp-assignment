# sync-service (Spring Boot) — build with Maven, run JRE only
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build
WORKDIR /src
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-alpine
RUN adduser -D -u 10001 app
WORKDIR /app
COPY --from=build /src/target/*.jar /app/app.jar
USER app
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
