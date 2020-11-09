import React, {useState} from 'react'
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import { makeStyles } from "@material-ui/styles";

const useStyles = makeStyles({
  actionTextField: {
    padding: "0px 10px 0px 0px",
  },
  actionForm: {
    padding: "20px 0px 0px 0px",
  }
});

export default function ActionPumpForm(props) {
  const emptyState = "";
  const [mL, setML] = useState(emptyState);
  const [duration, setDuration] = useState(emptyState);
  const classes = useStyles();
  const [isMLDisabled, setIsMLDisabled] = useState(false);
  const [isDurationDisabled, setIsDurationDisabled] = useState(false);

  function onSubmit(e) {
    e.preventDefault();
    if (mL !== emptyState || duration !== emptyState) {
      const params = mL !== "" ? { mL: mL } : { duration: duration };
      fetch(
        "/" +
          props.action +
          "/" +
          props.unitNumber +
          "?" +
          new URLSearchParams(params)
      );
    }
  }

  function handleMLChange(e) {
    setML(e.target.value);
    setIsDurationDisabled(true);
    if (e.target.value === emptyState) {
      setIsDurationDisabled(false);
    }
  }

  function handleDurationChange(e) {
    setDuration(e.target.value);
    setIsMLDisabled(true);
    if (e.target.value === emptyState) {
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
      <Button
        type="submit"
        variant="contained"
        color="primary"
        onClick={onSubmit}
      >
        Run
      </Button>
    </form>
  );
}