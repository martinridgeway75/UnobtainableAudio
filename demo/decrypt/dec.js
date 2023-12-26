/*global window*/
/*global document*/

window.addEventListener('load', function() {
    (function(){
        "use strict";

    const form = document.getElementById("dec-form");
    const field = document.getElementById("dec-field");
    const upload_label = document.getElementById("up-aud-label");
    const go_btn = document.getElementById("go-btn");
    const dl_section = document.getElementById("dl-section");
    let au = {};

    function unmakeb64Key(part) {
        return new Uint8Array(atob(part).split("").map(val => { return val.charCodeAt(0); }));
    }

    async function decrypt(encData, b64key, pswrdStr) {
        try {
            const parts = b64key.split("_");
            const rounds = parseInt(atob(parts[0]));
            const salt = unmakeb64Key(parts[1]);
            const iv = unmakeb64Key(parts[2]);

            const pass = await crypto.subtle.importKey('raw', new TextEncoder().encode(pswrdStr), { "name": "PBKDF2" }, false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits({ "name": "PBKDF2", "salt": salt, "iterations": rounds, "hash": { "name": "SHA-256" } }, pass, 256);
            const key = await crypto.subtle.importKey('raw', bits, { "name": "AES-GCM" }, false, ['decrypt']);
            const aud = await crypto.subtle.decrypt({ "name": "AES-GCM", "iv": iv }, key, encData);

            return aud;
        }
        catch(e) {
            freezeFormOnError("Decryption error");
        }
    }
    
    function decryptFile() {
        const encData = au.encData;
        const b64key = au.b64key;
        const pswrdStr = au.pswrdStr;

        decrypt(encData, b64key, pswrdStr).then((aud) => { 
            if (!aud) { return false; }

            au.dlBlob = new Blob([aud],{type: "application/octet-stream"});
            freezeFormDisplayInfo();
        });
        return false;
    }

    function splitBlob(outBlob) {
        const decoder = new TextDecoder();
        const uuid = outBlob.slice(-36);
        
        au.b64keyName = decoder.decode(uuid);
        au.encData = outBlob.slice(0, -36); //the encrypted arrayBuffer
        
        fetchKeyWithUuid().then((b64key) => {
            if (!b64key) {
                freezeFormOnError("Key not found");
                return;
            }
            au.b64key = b64key;
        });
    }

    async function fetchKeyWithUuid() {
        const url = "db/" + au.b64keyName + ".txt";

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Key not found"); //e.g. 404
            }
            const b64key = await response.text();
            return b64key;
          } catch(e) {
            freezeFormOnError("Key not found");
        }
    }

    function getBinUploaded(el) {
        let tgt = el.target.files[0];
        let rdr = new FileReader();

        rdr.onloadend = function() {
            splitBlob(rdr.result);
            document.getElementById("up-aud-label").textContent = tgt.name;
            au.decDataName = rmvExtension(tgt.name);
        }
        rdr.readAsArrayBuffer(tgt);
    }

    function freezeForm(msg) {
        go_btn.classList.remove("btn-primary");
        go_btn.style.borderColor = "transparent";
        go_btn.textContent = msg;
        document.getElementById("dec-field").disabled = true;
    }
    
    function freezeFormOnError(msg) {
        au = {};
        freezeForm(msg);
    }

    function chkReqProps() {
        if (!au.encData?.byteLength) { return false; }
        if (!au.b64key?.length) { return false; }
        if (!au.pswrdStr?.length) { return false; }
        return true;
    }

    function readPwInput(evt) {
        const reqPropsExist = chkReqProps();

        au.pswrdStr = evt.target.value;
        go_btn.classList.remove("btn-primary");

        if (!reqPropsExist) { return; }
        go_btn.classList.add("btn-primary");
    }
    
    function confirmCanDecrypt() {
        const reqPropsExist = chkReqProps();

        if (!reqPropsExist) { return; }
        if (!go_btn.classList.contains("btn-primary")) { return; }
        decryptFile();
    }

/*********************************/

function downloadAsFile(evt) {
    const tgtId = evt.target.id;

    if (tgtId !== "file-dl") { return; }

    const data = au.dlBlob;
    const dataName = au.decDataName;

    if (!data) { return; }
    if (!dataName?.length) { return; }

    saveFile(data, dataName);
}

async function saveFile(data, dataName) {
    try {
        const handle = await showSaveFilePicker({ suggestedName: dataName });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        return;
    }
    catch(e) {
        if (e.name !== 'AbortError') {
            console.error(e.name, e.message);
            return;
        }
    }
}

function rmvExtension(tgtName) {
    return (tgtName.substring(0, tgtName.lastIndexOf('.')) || tgtName);
}

function freezeFormDisplayInfo() {
    go_btn.classList.remove("btn-primary");
    go_btn.style.borderColor = "transparent";
    go_btn.textContent = "Decryption successful";
    field.disabled = true;
    dl_section.classList.remove("d-none");
    attachDownloadListeners();
}

function resetUa() {
    if (field.disabled == false) { return; }

    releaseDownloadListeners();
    go_btn.style.borderColor = "";
    go_btn.textContent = "Encrypt";
    dl_section.classList.add("d-none");
    upload_label.textContent = "Upload a file";
    field.disabled = false;
    form.reset();
    au = {};
}

function attachDownloadListeners() {
    document.getElementById("file-dl").addEventListener("click",downloadAsFile,{capture:false,passive:true});
}

function releaseDownloadListeners() {
    document.getElementById("file-dl").removeEventListener("click",downloadAsFile,{capture:false,passive:true});
}

function handlersOn() {
    document.getElementById("up-aud").addEventListener("change",getBinUploaded,{capture:false,passive:true});
    document.getElementById("pass1").addEventListener("input",readPwInput,{capture:false,passive:true});
    go_btn.addEventListener("click",confirmCanDecrypt,{capture:false,passive:true});
    document.getElementById("reset-btn").addEventListener("click",resetUa,{capture:false,passive:true});
}

function detectFeatures() {
    if (!"crypto" in window) { return; }
    if (!"showSaveFilePicker" in window) { return; }
    if (window.self !== window.top) { return; }
    
    handlersOn();
}

detectFeatures();

    })();
});