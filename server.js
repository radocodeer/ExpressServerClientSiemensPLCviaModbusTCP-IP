//libraries
const express = require('express');
const Modbus = require('modbus-serial');
const path = require('path');

//create express node.js server!
const app = express();
const port = 3000;

// Create a Modbus client
const client = new Modbus();

// Set the Modbus server IP address and port
const serverIP = '192.168.227.11'; // PLC as modbus tcpip server!
const serverPort = 502; // Modbus TCP/IP default port is 502

const BoolQuantity = 1; // Quantity for reading boolean array
const FloatQuantity = 2; // Quantity for reading float values
const IntQuantity = 1; // Quantity for reading integers (one register per integer)

let RealArr = []; // Array to hold all real values
let boolArrays = []; // Array to hold all boolean arrays
let IntArr = []; // Array to hold all int values
let cnt = 0;

// Connect to the Modbus server once at startup
client.connectTCP(serverIP, { port: serverPort })
    .then(() => {
        console.log('Connected to Modbus server');
    })
    .catch(err => {
        console.error('Error connecting to Modbus server:', err);
    });

// Function to read holding registers
function readRegisters(startAddress, quantity) {
    return new Promise((resolve, reject) => {
        client.readHoldingRegisters(startAddress, quantity, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

// Function to read multiple registers sequentially and process the data
function readSequentialRegisters(startAddresses, quantity, processData) {
    const promises = startAddresses.map((address, index) => 
        readRegisters(address, quantity)
            .then(data => processData(data, index))
    );
    return Promise.all(promises);
}

// Serve the static HTML page at the root route, Server response with HTML page, When Page loaded!
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to read data from PLC... When "/data" requested, also one time on page load, or when continues reading enabled!
app.get('/data', async (req, res) => {
    try {
        
        const boolArrayAddresses = [0, 1, 2, 3, 4, 5]; // Correct addresses for boolean arrays from PLC!

        // Read boolean arrays
        await readSequentialRegisters(boolArrayAddresses, BoolQuantity, (data, index) => {
            boolArrays[index] = data;            
        });
       
        // Read floats from addresses 6 to 26
        const floatAddresses = Array.from({ length: 20 }, (_, i) => i * 2 + 6); // Generates addresses 6, 8, 10, ..., 24
        await readSequentialRegisters(floatAddresses, FloatQuantity, (data, index) => {
            RealArr[index] = data.buffer.readFloatBE(0).toFixed(2);
        });

        // Read INTs 46 to 49
        const intAddresses = [46, 47, 48, 49];
        await readSequentialRegisters(intAddresses, IntQuantity, (data, index) => {
            IntArr[index] = data.buffer.readInt16BE(0);
        });
        //Check how many times reading was requested and succesfully answered!
        cnt++;
        console.log(`Read ${cnt} times. Data successfully fetched.`);

        //send to the client data in JSON Format!
        res.json({
            boolArray1: boolArrays[0],
            boolArray2: boolArrays[1],
            boolArray3: boolArrays[2],
            boolArray4: boolArrays[3],
            boolArray5: boolArrays[4],
            boolArray6: boolArrays[5],
            realArray: RealArr,
            intArray: IntArr // Include intArray in the response
        });
    } catch (err) { //catch errors!
        console.error('Error:', err);
        res.status(500).send('Error reading PLC data');
    }
});

app.listen(port, () => { //Server listen here..
    console.log(`Server is running on http://localhost:${port}`);
});
