import React from "react";
import ClearIcon from '@material-ui/icons/Clear';
import Button from "@material-ui/core/Button";
import { makeStyles } from '@material-ui/core/styles';
import clearChartCommand from './clearChartCommand'

const useStyles = makeStyles((theme) => ({
  textIcon: {
    fontSize: 15,
    verticalAlign: "middle",
    margin: "0px 3px"
  },
}))


function ClearChartButton(props){
  const classes = useStyles();

  function onClick(){
    clearChartCommand(props)
    setTimeout(function(){window.location.reload()}, 1200)
    return false
  }


  return (
    <Button color="primary" style={{textTransform: "none"}} onClick={onClick}><ClearIcon className={classes.textIcon}/> Clear charts </Button>
)}


export default ClearChartButton;
