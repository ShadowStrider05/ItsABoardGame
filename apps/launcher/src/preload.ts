import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("launcherApi", {
  getState: () => ipcRenderer.invoke("launcher:getState"),
  saveAccount: (accountName: string) => ipcRenderer.invoke("launcher:saveAccount", accountName),
  checkUpdates: () => ipcRenderer.invoke("launcher:checkUpdates"),
  openDownload: () => ipcRenderer.invoke("launcher:openDownload"),
  openPatchNotes: () => ipcRenderer.invoke("launcher:openPatchNotes"),
  launchGame: () => ipcRenderer.invoke("launcher:launchGame")
});
