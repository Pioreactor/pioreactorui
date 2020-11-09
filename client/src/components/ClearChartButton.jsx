import React from "react";

import Button from "@material-ui/core/Button";



function ClearChartButton(){

  function onClick() {
    fetch("/clear_charts")
    window.location.reload(false);
  }

  return (
    <Button onClick={onClick}> Clear chart data </Button>
)}


export default ClearChartButton;
