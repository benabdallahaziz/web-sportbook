@echo off
REM Arrete MySQL/MariaDB proprement (vide les journaux InnoDB avant de s'arreter).
REM A utiliser A LA PLACE du bouton Stop de XAMPP ou de la fermeture brutale du PC :
REM un arret force peut corrompre les journaux InnoDB (erreur "MySQL shutdown unexpectedly").
if "%XAMPP_DIR%"=="" set "XAMPP_DIR=C:\Users\lenovo\Desktop\XAMMP"

if not exist "%XAMPP_DIR%\mysql\bin\mysqladmin.exe" (
    echo ERREUR : mysqladmin introuvable dans %XAMPP_DIR%\mysql\bin
    echo Definis XAMPP_DIR vers ton dossier XAMPP, ex. : set XAMPP_DIR=C:\xampp
    pause
    exit /b 1
)

echo Arret propre de MySQL...
"%XAMPP_DIR%\mysql\bin\mysqladmin.exe" -u root shutdown
if errorlevel 1 (
    echo MySQL ne tournait pas, ou l'arret a echoue.
) else (
    echo MySQL est arrete proprement. Tu peux fermer XAMPP.
)
pause
