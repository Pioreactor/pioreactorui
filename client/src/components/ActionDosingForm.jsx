import React, {useState} from 'react'
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Snackbar from "@material-ui/core/Snackbar";
import { makeStyles } from "@material-ui/styles";

const useStyles = makeStyles({
  actionTextField: {
    padding: "0px 10px 0px 0px",
    width: "175px",
  },
  actionForm: {
    padding: "20px 0px 0px 0px",
  }
});


const actionToAct = {
  "remove_waste": "Removing waste",
  "add_media": "Adding media",
  "add_alt_media": "Adding alt. media",

}

export default function ActionPumpForm(props) {
  const EMPTYSTATE = "";
  const classes = useStyles();
  const [mL, setML] = useState(EMPTYSTATE);
  const [duration, setDuration] = useState(EMPTYSTATE);
  const [isMLDisabled, setIsMLDisabled] = useState(false);
  const [isDurationDisabled, setIsDurationDisabled] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);

  function onSubmit(e) {
    e.preventDefault();
    if (mL !== EMPTYSTATE || duration !== EMPTYSTATE) {
      const params = mL !== "" ? { ml: mL, source_of_event: "UI"} : { duration: duration, source_of_event: "UI"};
      fetch(`/run/${props.action}/${props.unit}`, {
        method: "POST",
        body: JSON.stringify(params),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      setOpenSnackbar(true);
    }
  }

  function stopPump(e) {
    fetch(`/stop/${props.action}/${props.unit}`, {method: "POST"})
  }

  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };

  function handleMLChange(e) {
    setML(e.target.value);
    setIsDurationDisabled(true);
    if (e.target.value === EMPTYSTATE) {
      setIsDurationDisabled(false);
    }
  }

  function handleDurationChange(e) {
    setDuration(e.target.value);
    setIsMLDisabled(true);
    if (e.target.value === EMPTYSTATE) {
      setIsMLDisabled(false);
    }
  }

  return (
    <form id={props.action} className={classes.actionForm}>
      <TextField
        name="mL"
        value={mL}
        size="small"
        id={props.action + "_mL"}
        label="mL"
        variant="outlined"
        disabled={isMLDisabled}
        onChange={handleMLChange}
        className={classes.actionTextField}
      />
      <TextField
        name="duration"
        value={duration}
        size="small"
        id={props.action + "_duration"}
        label="seconds"
        variant="outlined"
        disabled={isDurationDisabled}
        onChange={handleDurationChange}
        className={classes.actionTextField}
      />
      <br />
      <br />
      <div style={{display: "flex", justifyContent: "space-between"}}>
        <Button
          type="submit"
          variant="contained"
          size="small"
          color="primary"
          onClick={onSubmit}
        >
          {props.action.replace(/_/g, " ")}
        </Button>
        <Button
          size="small"
          color="secondary"
          onClick={stopPump}
        >
          Interrupt
        </Button>
      </div>
      <Snackbar
        anchorOrigin={{vertical: "bottom", horizontal: "center"}}
        open={openSnackbar}
        onClose={handleSnackbarClose}
        message={actionToAct[props.action] + (duration !== EMPTYSTATE ? (" for " +  duration + " seconds.") : (" until " + mL + "mL."))}
        autoHideDuration={7000}
        key={"snackbar" + props.unit + props.action}
      />
    </form>
  );
}