# ============================================================
#  Dockerfile pour coach-training-service (.NET 8 Web API)
#  Multi-stage build : Image finale ultra-légère et sécurisée
# ============================================================

# Étape 1 : Build et compilation
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# 1. Copier le fichier .csproj et restaurer les dépendances (optimisation cache Docker)
COPY ["coach-training-service.csproj", "./"]
RUN dotnet restore "coach-training-service.csproj"

# 2. Copier tout le code source et compiler en mode Release
COPY . .
RUN dotnet publish "coach-training-service.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Étape 2 : Image d'exécution finale (Runtime ASP.NET Core)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Copier les fichiers compilés depuis l'étape de build
COPY --from=build /app/publish .

# Port d'écoute du microservice Coach
EXPOSE 8087
ENV ASPNETCORE_URLS=http://+:8087
ENV ASPNETCORE_ENVIRONMENT=Production

# Point d'entrée
ENTRYPOINT ["dotnet", "coach-training-service.dll"]

