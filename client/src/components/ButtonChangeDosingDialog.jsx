import React, { useState, useEffect } from "react";

import { Client, Message } from "paho-mqtt";

import { makeStyles } from "@material-ui/styles";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Checkbox from "@material-ui/core/Checkbox";
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormLabel from '@material-ui/core/FormLabel';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
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




function ButtonChangeDosingDialog(props) {
  const classes = useStyles();
  const config = props.config
  const [open, setOpen] = useState(false);
  const [algoSettings, setAlgoSettings] = useState({dosing_automation: "silent", skip_first_run: false})
  const [isClicked, setIsClicked] = useState(false)
  const [client, setClient] = useState(null)
  const [automations, setAutomations] = useState({})


  useEffect(() => {
    async function fetchDosingAutomations() {
      await fetch("/contrib/automations/dosing")
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
    fetchDosingAutomations();
  }, [])

  useEffect(() => {
    // MQTT - client ids should be unique
    if (!config['network.topology']){
      return
    }

    var client
    if (config.remote && config.remote.ws_url) {
      client = new Client(
        `ws://${config.remote.ws_url}/`,
        "webui_ButtonChangeDosingDialog" + Math.random()
      )}
    else {
      client = new Client(
        `${config['network.topology']['leader_address']}`, 9001,
        "webui_ButtonChangeDosingDialog" + Math.random()
      );
    }

    client.connect();
    setClient(client)

  },[config])

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleAlgoSelectionChange = (e) => {
    setAlgoSettings({dosing_automation: e.target.value, skip_first_run: algoSettings.skip_first_run})
  }

  const handleSkipFirstRunChange = (e) => {
    setAlgoSettings({...algoSettings, skip_first_run: e.target.checked})
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
      "dosing_control",
      "dosing_automation",
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
      disabled={!props.currentDosingAutomation}
      onClick={handleClickOpen}
    >
      Change dosing automation
    </Button>
    <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title" PaperProps={{style: {height: "100%"}}}>
      <DialogTitle>
        <Typography className={classes.suptitle}>
          <PioreactorIcon style={{verticalAlign: "middle", fontSize: "1.2em"}}/> {props.title || ((config['ui.rename'] && config['ui.rename'][props.unit]) ? `${config['ui.rename'][props.unit]} (${props.unit})` : `${props.unit}`)}
        </Typography>
        <Typography className={classes.unitTitleDialog}>
          Dosing automation
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" component="p" gutterBottom>
          Dosing automations control when and how much media to add to the Pioreactor. The settings below can be changed later. Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/Dosing-automations">dosing automations</a>.
        </Typography>

        <form>
          <FormControl component="fieldset" className={classes.formControl}>
            <FormLabel component="legend">Automation</FormLabel>
            <Select
              native
              variant="standard"
              value={algoSettings["dosing_automation"]}
              onChange={handleAlgoSelectionChange}
              style={{maxWidth: "200px"}}
            >
              {Object.keys(automations).map((key) => <option id={key} value={key} key={"change-io" + key}>{automations[key].name}</option>)}
            </Select>

            {Object.keys(automations).length > 0 && <AutomationForm fields={automations[algoSettings["dosing_automation"]].fields} description={automations[algoSettings["dosing_automation"]].description} updateParent={updateFromChild}/>}

            <FormControlLabel
              control={<Checkbox checked={algoSettings.skip_first_run}
                                  color="primary"
                                  onChange={handleSkipFirstRunChange}
                                  size="small"/>
                      }
              label="Skip first run"
            />
            <Button
              type="submit"
              variant="contained"
              color={"primary" }
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


export default ButtonChangeDosingDialog;
