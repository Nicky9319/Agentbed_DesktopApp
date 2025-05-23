// Imports and modules !!! ---------------------------------------------------------------------------------------------------

import { app, shell, BrowserWindow, ipcMain, globalShortcut, contextBridge } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from './resources/icon.png?asset'

const {spawn, exec} = require('child_process');
const fs = require('fs');

const path = require('path');

const {autoUpdater, AppUpdater} = require('electron-differential-updater');
const log = require('electron-log');

const {os} = require('os');
const {url} = require('inspector');

const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

import { initDb,
  getAgentsInfo,
  addAgentInfo,
  updateAgentEnvVariable} from './db/db.js';

import dotenv from 'dotenv';
dotenv.config();

import { execSync } from 'child_process';


// Imports and modules END !!! ---------------------------------------------------------------------------------------------------




// Variables and constants !!! ---------------------------------------------------------------------------------------------------

let mainWindow, store;
let ipAddress = process.env.SERVER_IP_ADDRESS || '';

log.transports.file.level = 'info';
autoUpdater.logger = log;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Variables and constants END !!! ---------------------------------------------------------------------------------------------------





// IPC On Section !!! ------------------------------------------------------------------------------------------------------

ipcMain.on('change-window', (event, arg) => {
  console.log("Changing The Application Window !!!!")
  window_name = "html/" + arg;
  // window_name = arg;
  mainWindow.loadFile(window_name);
})

// IPC On Section END !!! ---------------------------------------------------------------------------------------------------





// IPC Handle Section !!! ------------------------------------------------------------------------------------------------------


ipcMain.handle('get-ip-address', async (event) => {
});


ipcMain.handle('store-data', (event, key, value) => {
  storeStoreData(key, value);
});

ipcMain.handle('store-has', (event, key) => {
  return storeHas(key);
});

ipcMain.handle('get-data', (event, key) => {
  return storeGetData(key);
});

ipcMain.handle('delete-data', (event, key) => {
  storeDeleteData(key);
});


ipcMain.handle('show-dialog', async (event, dialogType, dialogTitle, dialogMessage) => {
  await dialog.showMessageBox({
    type: dialogType,
    title: dialogTitle,
    message: dialogMessage
  })

  return;
});



ipcMain.handle('start-agent', (event, agentId) => {

})

ipcMain.handle('stop-agent', (event, agentId) =>{

})



ipcMain.handle('db:getAgentsInfo', async () => {
  return await getAgentsInfo();
});

// Add a new agent
ipcMain.handle('db:addAgentInfo', async (event, agentInfo) => {
  return await addAgentInfo(agentInfo);
});

// New handler for updating environment variables
ipcMain.handle('db:updateAgentEnv', async (event, agentId, varName, varValue) => {
  return await updateAgentEnvVariable(agentId, varName, varValue);
});


// IPC Handle Section END !!! ---------------------------------------------------------------------------------------------------







// Auto Update Section !!! -------------------------------------------------------------------------------------

autoUpdater.on('checking-for-update', () => {
  console.log("Checking for Update")
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  // autoUpdater.downloadUpdate();
  log.info('Update available.');
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.');
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater. ' + err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = 'Download speed: ' + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')';
  log.info(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded');
});

// Auto Updater Section END !!! ----------------------------------------------------------------------------------






// Electron - Store Utility Section !!! -------------------------------------------------------------------------------------

function storeStoreData(key, value) {
  store.set(key, value);
}

function storeHas(key) {
  return store.has(key);
}

function storeGetData(key) {
  return store.get(key);
}

function storeDeleteData(key) {
  store.delete(key);
}

// Electron Store Utility Section END !!! ----------------------------------------------------------------------------------






// Utility Functions Section !!! -------------------------------------------------------------------------------------

async function executeCMDCommand(command, needOutput = false) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(`Exec error: ${error}`);
        reject(error);
      } else {
        if (stdout) console.log(`Stdout: ${stdout}`);
        if (stderr) console.log(`Stderr: ${stderr}`);

        if (needOutput) resolve(stdout);
        else resolve();
      }
    });
  });
}

async function loadStore() {
  const Store = (await import('electron-store')).default;
  const store = new Store();
  return store;
}

async function waitForDockerPing() {
  return new Promise(async (resolve, reject) => {
    // const pingInterval = setInterval(async () => {
    //   try {
    //     await docker.ping();
    //     console.log("Engine is Running !!!");
    //     resolve();
    //     clearInterval(pingInterval);
    //   } catch (error) {
    //     console.log("Docker Engine Not Ready Yet");
    //   }
    // }, 5000);


  });
}

// Utility Functions Section END !!! --------------------------------------------------------------------------------






// Config WSL Section !!! -------------------------------------------------------------------------------------



// Config WSL Section END !!! --------------------------------------------------------------------------------







// App Event Trigger Section !!! --------------------------------------------------------------------------------



async function handleEvent(eventInfo) {
  console.log("Event Triggered")
  // console.log(eventInfo);
  console.log(eventInfo["AGENT_ID"])

  if (eventInfo["EVENT"] == "INSTALL_AGENT") {
    mainWindow.webContents.send('install-agent', agentId = eventInfo["AGENT_ID"], agentVersion = eventInfo["AGENT_VERSION"])
  }
  else if (eventInfo["EVENT"] == "UI_AUTOMATE") {
    uiAutomateHandler(eventInfo["DATA"]);
  }

}

async function handleWebEventTrigger(url) {
  console.log("Event Triggered")
  console.log(url);
  let eventInfo = url.replace(/^agentbed:\/\//i, '');

  if (eventInfo.endsWith('/')) {
    eventInfo = eventInfo.slice(0, -1);
  }

  try {
    const decoded = decodeURIComponent(eventInfo);
    const parsed = JSON.parse(decoded);
    console.log('Received AgentBed event:', parsed);
    await handleEvent(parsed);
  } catch (e) {
    console.log('Failed to parse AgentBed event:', eventInfo, e);
  }

}


// App Event Trigger Section END !!! ---------------------------------------------------------------------------




// App Section !!! -------------------------------------------------------------------------------------

app.on('second-instance', (event, argv) => {
  const urlArg = argv.find(arg => arg.startsWith('agentbed://'));
  if (urlArg) {
    console.log('Second instance with protocol:', urlArg);
    if (mainWindow) {
      handleWebEventTrigger(urlArg);
    }
  }
});

app.whenReady().then(async () => {

  // Single Instance Check 
  const AppLock = app.requestSingleInstanceLock();
  if (!AppLock) {app.exit(0);}

  // Global Shortcuts
  globalShortcut.register('CommandOrControl+R', () => {
    console.log('Ctrl+R is disabled');
  });

  globalShortcut.register('F5', () => {
    console.log('F5 is disabled');
  });

  // Initialize DB 
  try{ initDb()}
  catch (error) { console.error('Failed to initialize database:', error); }

  // Load Store
  store = await loadStore();

  // Auto Updater
    // autoUpdater.setFeedURL({
    //   provider: 'github',
    //   owner: 'Nicky9319',
    //   repo: 'UserApplication_UpdateRepo',
    //   private: false,
    // });  

    // autoUpdater.checkForUpdates();
  

  // Creating Window
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 1024,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      devTools: true,
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })


  // Loading HTML and Configuring the Window
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.setMenuBarVisibility(false);


  // Register Protocol with the Windows

  if (process.platform === 'win32') {
    const urlArg = process.argv.find(arg => arg.startsWith('agentbed://'));
    if (urlArg) {
      mainWindow.webContents.once('did-finish-load', () => {
        handleWebEventTrigger(urlArg)
      });
    }
  }


});

app.on('will-quit' , async (event) => {
  event.preventDefault();
  console.log("Quitting The Application !!!");

  globalShortcut.unregisterAll();
  app.exit(0);
});


// App Section END !!! --------------------------------------------------------------------------------









// function createWindow() {
//   initDb()
//   .then(() => { 
//     console.log('Database initialized successfully');
//     addAgentInfo({ id: 1, name: 'Agent 1', env: {} })

//   });
  
//   // Create the browser window.
//   const mainWindow = new BrowserWindow({
//     width: 1440,
//     height: 1024,
//     show: false,
//     autoHideMenuBar: true,
//     ...(process.platform === 'linux' ? { icon } : {}),
//     webPreferences: {
//       preload: join(__dirname, '../preload/preload.js'),
//       sandbox: false
//     }
//   })

//   mainWindow.on('ready-to-show', () => {
//     mainWindow.show()
//   })

//   mainWindow.webContents.setWindowOpenHandler((details) => {
//     shell.openExternal(details.url)
//     return { action: 'deny' }
//   })

//   // HMR for renderer base on electron-vite cli.
//   // Load the remote URL for development or the local html file for production.
//   if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
//     mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
//   } else {
//     mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
//   }
// }

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

// app.whenReady().then(() => {
//   // Set app user model id for windows
//   electronApp.setAppUserModelId('com.electron')

//   // Default open or close DevTools by F12 in development
//   // and ignore CommandOrControl + R in production.
//   // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils


//   // app.on('browser-window-created', (_, window) => {
//   //   optimizer.watchWindowShortcuts(window)
//   // })

//   // IPC test
//   ipcMain.on('ping', () => console.log('pong'))

//   createWindow()

//   app.on('activate', function () {
//     // On macOS it's common to re-create a window in the app when the
//     // dock icon is clicked and there are no other windows open.
//     if (BrowserWindow.getAllWindows().length === 0) createWindow()
//   })
// })

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') {
//     app.quit()
//   }
// })

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
