import React, {useState} from 'react'
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Snackbar from "@material-ui/core/Snackbar";
import { makeStyles } from "@material-ui/styles";

const useStyles = makeStyles({
  actionTextField: {
    padding: "0px 10px 0px 0px",
  },
  actionForm: {
    padding: "10px 0px 0px 0px",
  }
});



export default function ActionLEDForm(props) {
  const EMPTYSTATE = "";
  const classes = useStyles();
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [intensity, setIntensity] = useState(EMPTYSTATE);

  function onSubmit(e) {
    e.preventDefault();
    if (intensity !== EMPTYSTATE) {
      // TODO: this should also fire an mqtt event to set it in LEDAlgorithm, in case that is running
      const params = { intensity: intensity, channel: props.channel, source_of_event: "UI"}
      fetch(
        "/run/" +
          "led_intensity" +
          "/" +
          props.unit +
          "?" +
          new URLSearchParams(params)
      );
      setOpenSnackbar(true);
    }
  }


  function handleChange(e) {
    setIntensity(e.target.value);
  }

  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };


  return (
    <form id={props.action} className={classes.actionForm}>
      <TextField
        name="intensity"
        value={intensity}
        size="small"
        id={props.channel + "_intensity_edit"}
        label="new intensity [0-100]"
        variant="outlined"
        onChange={handleChange}
        className={classes.actionTextField}
      />
      <br />
      <br />
      <Button
        type="submit"
        variant="contained"
        size="small"
        color="primary"
        onClick={onSubmit}
      >
      Submit
      </Button>
      <Snackbar
        anchorOrigin={{vertical: "bottom", horizontal: "center"}}
        open={openSnackbar}
        onClose={handleSnackbarClose}
        message={`Updating Channel ${props.channel} LED to ${intensity}.`}
        autoHideDuration={7000}
        key={"snackbar" + props.unit + props.channel}
      />
    </form>
  );
}