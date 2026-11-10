# --- build: restore + publish -------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first (cached unless project files change)
COPY SchoolAdmission.sln ./
COPY src/SchoolAdmission.Api/SchoolAdmission.Api.csproj src/SchoolAdmission.Api/
COPY tests/SchoolAdmission.Api.Tests/SchoolAdmission.Api.Tests.csproj tests/SchoolAdmission.Api.Tests/
RUN dotnet restore SchoolAdmission.sln

COPY . .
RUN dotnet build SchoolAdmission.sln -c Release --no-restore \
 && dotnet publish src/SchoolAdmission.Api -c Release -o /app --no-build

# --- test: `docker compose --profile test run --rm backend-tests` ---------------
FROM build AS test
ENV TEST_DB_CONNECTION="Host=postgres;Port=5432;Username=postgres;Password=postgres"
ENTRYPOINT ["dotnet", "test", "SchoolAdmission.sln", "-c", "Release", "--no-build", "--logger", "console;verbosity=normal"]

# --- runtime ------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
