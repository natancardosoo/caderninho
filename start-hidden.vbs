' Inicia o servidor sem abrir janela (Windows). Para abrir junto com o Windows,
' crie um atalho deste arquivo na pasta shell:startup.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
If Not fso.FolderExists("data") Then fso.CreateFolder("data")
sh.Run "cmd /c node server.js >> data\server.log 2>&1", 0, False
