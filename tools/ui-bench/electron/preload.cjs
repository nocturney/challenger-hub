'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('benchmarkBridge',{
 search:(query,category)=>ipcRenderer.invoke('search_catalog',query,category),
 ready:message=>ipcRenderer.invoke('bench_ready',message)
});
