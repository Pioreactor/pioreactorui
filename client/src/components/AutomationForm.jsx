import React, {useEffect } from "react";
import { makeStyles } from "@material-ui/styles";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";


const useStyles = makeStyles((theme) => ({
  textFieldCompact: {
    marginTop: theme.spacing(3),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0),
    width: "30ch",
  }
}));



function AutomationForm(props){
  const classes = useStyles();
  const defaults = Object.assign({}, ...props.fields.map(field => ({[field.name]: field.default})))

  useEffect(() => {
    props.updateParent(defaults)
  }, [props.fields])

  const onSettingsChange = (e) => {
    props.updateParent({[e.target.id]: e.target.value})
  }
  var listOfTextField = props.fields.map(field =>
        <TextField
          size="small"
          id={field.name}
          key={field.name}
          label={field.label}
          defaultValue={field.default}
          InputProps={{
            endAdornment: <InputAdornment position="end">{field.unit}</InputAdornment>,
          }}
          variant="outlined"
          onChange={onSettingsChange}
          className={classes.textFieldCompact}
        />
  )

  return (
      <div>
        {listOfTextField}
    </div>
)}


export default AutomationForm;