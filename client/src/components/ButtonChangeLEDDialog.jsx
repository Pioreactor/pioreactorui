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
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import Snackbar from "@material-ui/core/Snackbar";

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



function ButtonChangeLEDDialog(props) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [algoSettings, setAlgoSettings] = useState({automation_name: "silent", skip_first_run: false})
  const [client, setClient] = useState(null)
  const [automations, setAutomations] = useState({})
  const [openSnackbar, setOpenSnackbar] = useState(false);


  useEffect(() => {
    async function fetchLEDAutomations() {
      await fetch("/contrib/automations/led")
        .then((response) => {
            if (response.ok) {
              return response.json();
            } else {
              throw new Error('Something went wrong');
            }
          })
        .then((listOfAuto) => {
          setAutomations(Object.assign({}, ...listOfAuto.map(auto => ({ [auto.automation_name]: auto}))))
        })
        .catch((error) => {})
    }
    fetchLEDAutomations();
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
        "webui_ButtonChangeLEDDialog" + Math.random()
      )}
    else {
      client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui_ButtonChangeLEDDialog" + Math.random()
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
    setAlgoSettings({automation_name: e.target.value})
  }

  const updateFromChild = (setting) => {
    setAlgoSettings(prevState => ({...prevState, ...setting}))
  }


  const onSubmit = (event) => {
    event.preventDefault()
    var message = new Message(JSON.stringify(algoSettings));
    message.destinationName = [
      "pioreactor",
      props.unit,
      props.experiment,
      "led_control",
      "led_automation",
      "set",
    ].join("/");
    message.qos = 2;
    try{
      client.publish(message);
      setOpenSnackbar(true);

    }
    catch (e){
      console.log(e)
    }
    setOpen(false);
  }


  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };

  return (
    <div>
      <Button
        style={{marginTop: "10px"}}
        size="small"
        color="primary"
        disabled={!props.currentLEDAutomation}
        onClick={handleClickOpen}
      >
        Change LED automation
      </Button>
      <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title" PaperProps={{style: {height: "100%"}}}>
        <DialogTitle>
          <Typography className={classes.suptitle}>
            <PioreactorIcon style={{verticalAlign: "middle", fontSize: "1.2em"}}/> {props.title || ((props.config['ui.rename'] && props.config['ui.rename'][props.unit]) ? `${props.config['ui.rename'][props.unit]} (${props.unit})` : `${props.unit}`)}
          </Typography>
          <Typography className={classes.unitTitleDialog}>
            Change LED automation
          </Typography>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" component="p" gutterBottom>
            LED automations control how and when to provide light to the Pioreactor. The settings below can be changed later. Learn more about <a target="_blank" rel="noopener noreferrer" href="https://docs.pioreactor.com/user_guide/Automations/LED%20Automations">LED automations</a>.
          </Typography>

          <form>
            <FormControl component="fieldset" className={classes.formControl}>
            <FormLabel component="legend">Automation</FormLabel>
              <Select
                native
                variant="standard"
                value={algoSettings.automation_name}
                onChange={handleAlgoSelectionChange}
                style={{maxWidth: "200px"}}
              >
                {Object.keys(automations).map((key) => <option id={key} value={key} key={"change-io" + key}>{automations[key].display_name}</option>)}

              </Select>

              {Object.keys(automations).length > 0 && <AutomationForm fields={automations[algoSettings.automation_name].fields} description={automations[algoSettings["automation_name"]].description} updateParent={updateFromChild}/>}

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
      <Snackbar
        anchorOrigin={{vertical: "bottom", horizontal: "center"}}
        open={openSnackbar}
        onClose={handleSnackbarClose}
        message={`Changing LED automation to ${algoSettings.automation_name}.`}
        autoHideDuration={7000}
        key={"snackbar-change-led"}
      />
    </div>
)}


export default ButtonChangeLEDDialog;
