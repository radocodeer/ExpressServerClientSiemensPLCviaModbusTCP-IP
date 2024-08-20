// server.js
const express = require('express');
const Modbus = require('modbus-serial');
const path = require('path');
const db = require('./database'); // Require the MySQL database module

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

const client = new Modbus();
const serverIP = '192.168.227.11';
const serverPort = 502;

const BoolQuantity = 1;
const FloatQuantity = 2;
const IntQuantity = 1;

let cnt = 0;

let RadoTest = '';

let RealArr = [];
let boolArrays = [];
let IntArr = [];
let ServerText = "toto je text zo servera pre clienta!";

// Connect to Modbus server
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

// Function to write a single register (for booleans or integers)
function writeRegisters(startAddress, value) {
    return new Promise((resolve, reject) => {
        client.writeRegister(startAddress, value, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

// Function to write a float value (using two registers)
function writeFloatRegister(address, value) {
    const buffer = Buffer.alloc(4);
    buffer.writeFloatBE(value);
    const highBits = buffer.readUInt16BE(0);
    const lowBits = buffer.readUInt16BE(2);

    return Promise.all([
        writeRegisters(address, highBits),
        writeRegisters(address + 1, lowBits)
    ]);
}

// Function to read multiple registers sequentially and process the data
function readSequentialRegisters(startAddresses, quantity, processData) {
    const promises = startAddresses.map((address, index) => 
        readRegisters(address, quantity)
            .then(data => processData(data, index))
    );
    return Promise.all(promises);
}

// Function to save data to the MySQL database
function saveDataToDB(RealArr, IntArr, RadoTest) {    
    db.query(`
        INSERT INTO RadovaPLC_Databaza (REALs, INTs, RadoColumn)
        VALUES (?, ?, ?)`,
        [             
            JSON.stringify(RealArr), 
            JSON.stringify(IntArr),
            JSON.stringify(RadoTest),
        ],
        function(err) {
            if (err) {
                return console.error('Error inserting data:', err);
            }
            console.log(`Data saved successfully`);
        });
}

app.get('/data', async (req, res) => {
    try {
               
        const boolArrayAddresses = [0, 1, 2, 3, 4, 5];

        await readSequentialRegisters(boolArrayAddresses, BoolQuantity, (data, index) => {
            boolArrays[index] = data;
        });
        let boolValue = false;
        if (boolArrays[2].data == 32768){
            boolValue = true;
        }
        else {
            boolValue = false;
        }        

        //console.log(boolValue);

        const floatAddresses = Array.from({ length: 20 }, (_, i) => i * 2 + 6);
        await readSequentialRegisters(floatAddresses, FloatQuantity, (data, index) => {
            RealArr[index] = data.buffer.readFloatBE(0).toFixed(2);
        });

        const intAddresses = [46, 47, 48, 49];
        await readSequentialRegisters(intAddresses, IntQuantity, (data, index) => {
            IntArr[index] = data.buffer.readInt16BE(0);
        });
        
        // Save the data to the MySQL database
        if (boolValue){
            cnt++;
            RadoTest = 'Hello World!' + cnt;
            saveDataToDB(RealArr, IntArr, RadoTest); 
        }        
        
        res.json({
            boolArray1: boolArrays[0],
            boolArray2: boolArrays[1],
            boolArray3: boolArrays[2],
            boolArray4: boolArrays[3],
            boolArray5: boolArrays[4],
            boolArray6: boolArrays[5],
            realArray: RealArr,
            intArray: IntArr,
            ServerText,
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error reading PLC data');
    }
});

// API endpoint to write data to PLC
app.post('/write', express.json(), async (req, res) => {
    const { address, bitIndex, newValue, test } = req.body;
    console.log("address  " + address + " bitIndex " + bitIndex + " newValue " + newValue + " rado test " + test);
    if (address === undefined || bitIndex === undefined || newValue === undefined) {
        return res.status(400).send('Invalid values');
    }

    try {
        // Read the current value
        const data = await readRegisters(address, BoolQuantity);
        let currentValue = data.data[0];

        // Toggle the specific bit
        if (newValue === 1) {
            currentValue |= (1 << bitIndex); // Set the bit
        } else {
            currentValue &= ~(1 << bitIndex); // Clear the bit
        }

        // Write the new value back to the register
        await writeRegisters(address, [currentValue]);

        res.send('Successfully updated PLC data');
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error writing PLC data');
    }
});

// API endpoint to update real values
app.post('/update-real', express.json(), async (req, res) => {
    const { address, newValue } = req.body;

    try {
        await writeFloatRegister(address, parseFloat(newValue));
        res.status(200).send('Real value updated successfully');
    } catch (err) {
        console.error('Error updating real value:', err);
        res.status(500).send('Error updating real value');
    }
});

// API endpoint to update integer values
app.post('/update-int', express.json(), async (req, res) => {
    const { address, newValue } = req.body;

    try {
        await writeRegisters(address, parseInt(newValue, 10));
        res.status(200).send('Integer value updated successfully');
    } catch (err) {
        console.error('Error updating integer value:', err);
        res.status(500).send('Error updating integer value');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
