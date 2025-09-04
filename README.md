# Modbus Wind Reader

uh... just a simple node.js project to read windspeed from a modbus-rs485 anemometer using the modbus-serial package

## Dependencies

-   `axios`(for api :3)
-   `colors`(for colored terminal :D)
-   `dotenv`
-   `modbus-serial`
-   `serialport`

install them with:

```
npm i
```

## Run

you can run it however you like e.g.

```
node index.js
```

```
nodemon
```

or

```
pm2 start index.js --name modbus-wind-reader
```

## Troubleshooting

### no readings / timeout error

this can happen for a few reasons (as i tested myself):

-   **wrong wiring**: double-check your a/b or power (+/-) wires and make sure they are correct.

-   **insufficient power**: most usb-to-rs485 adapters (if you are using one) might not provide enough power, since usb ports usually only give 5v. some anemometers might need more than that.

-   **wrong baud rate**: sometimes too high a baud rate can cause timeout errors. try lowering it to your sensor's default (4800 bps in most cases).

-   **another process is using the same serial port**: if another process is reading the same serial port, it can cause errors.

### permission issue

this typically means you need to give your user access to the serial port.

on linux, you can do:

```
sudo usermod -a -G dialout $USER
```

then log out and log back in
