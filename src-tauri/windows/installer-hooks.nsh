!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Judie" '"$INSTDIR\${MAINBINARYNAME}.exe"'
  Exec '"$INSTDIR\${MAINBINARYNAME}.exe"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Judie"
!macroend
