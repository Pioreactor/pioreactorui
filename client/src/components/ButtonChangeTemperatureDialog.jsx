import React, { useState, useEffect } from "react";

import { Client, Message } from "paho-mqtt";

import { makeStyles } from "@material-ui/styles";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormLabel from '@material-ui/core/FormLabel';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import PioreactorIcon from "./PioreactorIcon"
import AutomationForm from "./AutomationForm"

const useStyles = makeStyles((theme) => ({
  formControl: {
    marginTop: theme.spacing(2)
  },
  unitTitle: {
    fontSize: 17,
    color: "rgba(0, 0, 0, 0.87)",
  },
  unitTitleDialog :{
    fontSize: 20,
    color: "rgba(0, 0, 0, 0.87)",
  },
  suptitle: {
    fontSize: "13px",
    color: "rgba(0, 0, 0, 0.60)",
  },
}));


function ButtonChangeTemperatureDialog(props) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [algoSettings, setAlgoSettings] = useState({temperature_automation: "silent", skip_first_run: false})
  const [isClicked, setIsClicked] = useState(false)
  const [client, setClient] = useState(null)
  const [automations, setAutomations] = useState({})


  useEffect(() => {
    async function fetchTemperatureAutomations() {
      await fetch("/contrib/automations/temperature")
        .then((response) => {
            if (response.ok) {
              return response.json();
            } else {
              throw new Error('Something went wrong');
            }
          })
        .then((listOfAuto) => {
          setAutomations(Object.assign({}, ...listOfAuto.map(auto => ({ [auto.key]: auto}))))
        })
        .catch((error) => {})
    }
    fetchTemperatureAutomations();
  }, [])


  useEffect(() => {
    // MQTT - client ids should be unique
    if (!props.config['network.topology']){
      return
    }

    var client
    if (props.config.remote && props.config.remote.ws_url) {
      client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui_ButtonChangeTemperatureDialog" + Math.random()
      )}
    else {
      client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui_ButtonChangeTemperatureDialog" + Math.random()
      );
    }

    client.connect({timeout: 180});
    setClient(client)
  },[props.config])

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleAlgoSelectionChange = (e) => {
    setAlgoSettings({temperature_automation: e.target.value})
  }

  const updateFromChild = (setting) => {
    setAlgoSettings(prevState => ({...prevState, ...setting}))
  }


  const onSubmit = (event) => {
    event.preventDefault()
    setIsClicked(true)
    var message = new Message(JSON.stringify(algoSettings));
    message.destinationName = [
      "pioreactor",
      props.unit,
      props.experiment,
      "temperature_control",
      "temperature_automation",
      "set",
    ].join("/");
    message.qos = 2;
    try{
      client.publish(message);
    }
    catch (e){
      console.log(e)
    }
    setOpen(false);
  }
  return (
    <div>
    <Button
      style={{marginTop: "10px"}}
      size="small"
      color="primary"
      disabled={!props.currentTemperatureAutomation}
      onClick={handleClickOpen}
    >
      Change temperature automation
    </Button>
    <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title" PaperProps={{style: {height: "100%"}}}>
      <DialogTitle>
        <Typography className={classes.suptitle}>
          <PioreactorIcon style={{verticalAlign: "middle", fontSize: "1.2em"}}/> {props.title || ((props.config['ui.rename'] && props.config['ui.rename'][props.unit]) ? `${props.config['ui.rename'][props.unit]} (${props.unit})` : `${props.unit}`)}
        </Typography>
        <Typography className={classes.unitTitleDialog}>
          Temperature automation
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" component="p" gutterBottom>
          Temperature automations control the temperature of the Pioreactor's vial. The settings below can be changed later. Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/temperature-automations">temperature automations</a>.
        </Typography>

        <form>
          <FormControl component="fieldset" className={classes.formControl}>
          <FormLabel component="legend">Automation</FormLabel>
            <Select
              native
              variant="standard"
              value={algoSettings["temperature_automation"]}
              onChange={handleAlgoSelectionChange}
              style={{maxWidth: "200px"}}
            >
              {Object.keys(automations).map((key) => <option id={key} value={key} key={"change-io" + key}>{automations[key].name}</option>)}

            </Select>
            {Object.keys(automations).length > 0 && <AutomationForm fields={automations[algoSettings["temperature_automation"]].fields} description={automations[algoSettings["temperature_automation"]].description} updateParent={updateFromChild}/>}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              onClick={onSubmit}
              style={{width: "120px", marginTop: "20px"}}
            >
              Submit
            </Button>
          </FormControl>
        </form>


      </DialogContent>
    </Dialog>
    </div>
)}


export default ButtonChangeTemperatureDialog;
