@echo off
REM Script to run the complete workflow
cd /d "C:\Users\Lenono\Desktop\planner-app"

REM First check git status
echo [1] Git Status:
git --no-pager status --short
echo.
git rev-parse HEAD
echo.

REM Then run the Node workflow script
echo Running automated workflow...
node scripts\execute-workflow.mjs
