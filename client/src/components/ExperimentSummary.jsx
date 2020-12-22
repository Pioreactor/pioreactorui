import React from 'react'
import {makeStyles} from '@material-ui/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import {Typography} from '@material-ui/core';
import moment from "moment";
import Box from '@material-ui/core/Box';
import Snackbar from '@material-ui/core/Snackbar';
import ContentEditable from 'react-contenteditable'


const useStyles = makeStyles({
  root: {
    maxWidth: "600px"
  },
  title: {
    fontSize: 14,
  },
  cardContent: {
    padding: "10px"
  },
  pos: {
    marginBottom: 0,
  },
});



class EditableDescription extends React.Component {
  constructor(props) {
    super(props)
    this.contentEditable = React.createRef();
    this.state = {desc: "", openSnackBar: false, originalDesc: ""};
  };

  componentDidUpdate(prevProps) {
    if (this.props.description !== prevProps.description) {
      this.setState({desc: `${this.props.description}`, originalDesc: `${this.props.description}`})
    }
  }

  handleChange = evt => {
    this.setState({desc: evt.target.value});
  };

  onBlur = evt => {
    console.log("blur")
    if (this.state.desc !== this.state.originalDesc) {
      console.log("delta")
      this.setState({originalDesc: this.state.desc})
      return fetch('update_experiment_desc', {
          method: "POST",
          body: JSON.stringify({experiment : this.props.experiment, description: this.state.desc}),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }).then(res => {
          if (res.status === 200){
            this.setState({openSnackBar: true});
          }
        })
    }
  };

  handleSnackbarClose = (e, reason) => {
    if (reason !== "clickaway"){
      this.setState({openSnackBar: false});
    }
  };

  render = () => {
    return (
      <div>
        <ContentEditable
            innerRef={this.contentEditable}
            html={this.state.desc} // innerHTML of the editable div
            disabled={false}       // use true to disable editing
            onChange={this.handleChange} // handle innerHTML change
            onBlur={this.onBlur}
            tagName="p"
            style={{"padding": "3px 3px 3px 2px"}}
          />
          <Snackbar
            anchorOrigin={{vertical: "bottom", horizontal: "center"}}
            open={this.state.openSnackBar}
            onClose={this.handleSnackbarClose}
            message={"Updated description"}
            autoHideDuration={2500}
            key={"snackbarEditDesc"}
          />
      </div>
    )
  };
};


function ExperimentSummary(props){
  const classes = useStyles();
  const experiment = props.experimentMetadata.experiment || ""
  const startedAt = props.experimentMetadata.timestamp || moment()
  const desc = props.experimentMetadata.description || ""

  return(
    <Card className={classes.root}>
      <CardContent className={classes.cardContent}>
        <Typography className={classes.title} color="textSecondary" gutterBottom>
          Experiment
        </Typography>
        <Typography variant="h5" component="h2">
          {experiment}
        </Typography>
        <Typography variant="subtitle2">
          <Box fontWeight="fontWeightRegular">
            Start date: <span title={moment(startedAt).format("YYYY-MM-DD HH:mm:ss")}>{moment(startedAt).format("YYYY-MM-DD")}</span>
          </Box>
        </Typography>
        <Typography variant="subtitle2" >
          <Box fontWeight="fontWeightRegular">
            Elapsed: {(moment().diff(moment(startedAt), 'H'))}h
          </Box>
        </Typography>
        <EditableDescription experiment={experiment} description={desc} />
      </CardContent>
    </Card>
  )
}


export default ExperimentSummary;
