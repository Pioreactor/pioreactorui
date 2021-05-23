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



function AutomationForm({fields, updateParent}){
  const classes = useStyles();
  const defaults = Object.assign({}, ...fields.map(field => ({[field.key]: field.default})))

  useEffect(() => {
    updateParent(defaults)
  }, [fields, updateParent, defaults])

  const onSettingsChange = (e) => {
    updateParent({[e.target.id]: e.target.value})
  }
  var listOfTextField = fields.map(field =>
        <TextField
          size="small"
          id={field.key}
          key={field.key}
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