import React, { useEffect, useState, useRef } from 'react';
import { Layout, Card, Typography, Spin, Alert, Form, Input, Button, Space, Modal, Dropdown, Menu, message as antdMessage } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Editor } from '@tinymce/tinymce-react'; // TinyMCE
import { ArrowLeftOutlined, SaveOutlined, BulbOutlined, DownOutlined } from '@ant-design/icons';

import {
  fetchTemplateById,
  createTemplate,
  updateTemplate,
  clearCurrentTemplate,
  generateAiContent,
  clearAiGeneratedContent,
  selectCurrentTemplate,
  selectTemplatesLoading, // Page loading for existing template
  selectTemplatesSubmitting, // Save/Update loading
  selectTemplatesError,
  selectAiGeneratedContent,
  selectIsGeneratingAiContent,
  selectAiError,
} from '../store/slices/templatesSlice';

const { Header, Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;

// Basic list of variables. In a real app, this might be dynamic.
const placeholderVariables = [
  { key: 'email', label: 'Recipient Email', value: '{{email}}' },
  { key: 'first_name', label: 'First Name', value: '{{first_name}}' },
  { key: 'last_name', label: 'Last Name', value: '{{last_name}}' },
  { key: 'unsubscribe_url', label: 'Unsubscribe URL', value: '{{unsubscribe_url}}' },
  // Add more, potentially nested for custom_fields like '{{custom_fields.your_key}}'
];

const TemplateEditorPage = () => {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const editorRef = useRef(null); // Ref for TinyMCE editor instance

  // Local state
  const [bodyHtml, setBodyHtml] = useState('');
  const [isAiModalVisible, setIsAiModalVisible] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // Selectors
  const currentTemplate = useSelector(selectCurrentTemplate);
  const isLoading = useSelector(selectTemplatesLoading); // For initial load of template
  const isSubmitting = useSelector(selectTemplatesSubmitting); // For save/update
  const pageError = useSelector(selectTemplatesError); // Error loading template or CUD operations

  const aiGeneratedContent = useSelector(selectAiGeneratedContent);
  const isGeneratingAiContent = useSelector(selectIsGeneratingAiContent);
  const aiError = useSelector(selectAiError);

  const isEditing = !!templateId;

  // Fetch template if in edit mode
  useEffect(() => {
    if (isEditing) {
      dispatch(fetchTemplateById(templateId));
    } else {
      dispatch(clearCurrentTemplate()); // Ensure no stale data for new template
      form.resetFields(); // Reset form for new template
      setBodyHtml(''); // Reset editor content
    }
    // Cleanup on unmount
    return () => {
      dispatch(clearCurrentTemplate());
      dispatch(clearAiGeneratedContent());
    };
  }, [dispatch, templateId, isEditing]);

  // Populate form when currentTemplate data is available (for editing)
  useEffect(() => {
    if (isEditing && currentTemplate) {
      form.setFieldsValue({
        name: currentTemplate.name,
        subject: currentTemplate.subject,
      });
      setBodyHtml(currentTemplate.body_html || '');
    }
  }, [currentTemplate, isEditing, form]);

  const handleEditorChange = (content, editor) => {
    setBodyHtml(content);
  };

  const handleSaveTemplate = async (values) => {
    const templateData = {
      name: values.name,
      subject: values.subject,
      body_html: bodyHtml,
    };

    let actionResult;
    if (isEditing) {
      actionResult = await dispatch(updateTemplate({ templateId, templateData }));
    } else {
      actionResult = await dispatch(createTemplate(templateData));
    }

    if (actionResult.meta.requestStatus === 'fulfilled') {
      antdMessage.success(`Template ${isEditing ? 'updated' : 'created'} successfully!`);
      navigate('/templates');
    } else {
      // Error is handled by pageError selector and Alert component below
      // antdMessage.error(pageError || `Failed to ${isEditing ? 'update' : 'create'} template.`);
    }
  };

  // AI Assistant Modal
  const showAiModal = () => setIsAiModalVisible(true);
  const handleAiModalCancel = () => {
    setIsAiModalVisible(false);
    // dispatch(clearAiGeneratedContent()); // Optional: clear content when modal is closed
  };
  const handleGenerateAi = () => {
    if (!aiPrompt.trim()) {
      antdMessage.error('Please enter a prompt for the AI assistant.');
      return;
    }
    dispatch(generateAiContent(aiPrompt));
  };

  const handleInsertAiContent = () => {
    if (editorRef.current && aiGeneratedContent) {
      editorRef.current.insertContent(aiGeneratedContent);
      setIsAiModalVisible(false);
      dispatch(clearAiGeneratedContent()); // Clear after inserting
    }
  };

  // Insert Variable Dropdown
  const handleInsertVariable = (variableValue) => {
    if (editorRef.current) {
      editorRef.current.insertContent(variableValue);
    }
  };

  const variablesMenu = (
    <Menu onClick={({ key }) => handleInsertVariable(placeholderVariables.find(v => v.key === key)?.value)}>
      {placeholderVariables.map(variable => (
        <Menu.Item key={variable.key}>{variable.label} ({variable.value})</Menu.Item>
      ))}
    </Menu>
  );

  // TinyMCE API Key - Replace with your actual key or manage via .env
  const TINYMCE_API_KEY = process.env.REACT_APP_TINYMCE_API_KEY || 'no-api-key';


  if (isLoading && isEditing) {
    return <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></Layout>;
  }
  // This error is for page load (fetchTemplateById) or CUD operations
  // if (pageError && (isEditing || isSubmitting)) { // Show only if error is relevant to current operation
  //   return <Alert message="Error" description={pageError} type="error" showIcon closable onClose={() => navigate('/templates')} />;
  // }
  if (isEditing && !currentTemplate && !isLoading && pageError) { // If done loading but no template found for ID
    return <Layout style={{ padding: '24px' }}><Alert message="Error" description={`Template not found or failed to load: ${pageError}`} type="error" showIcon closable onClose={() => navigate('/templates')} /></Layout>;
  }


  return (
    <Layout>
      <Header style={{ backgroundColor: 'white', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/templates')}>
            Back to Templates
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            {isEditing ? 'Edit Email Template' : 'Create New Email Template'}
          </Title>
        </Space>
        <Space>
            <Button icon={<BulbOutlined />} onClick={showAiModal}>AI Assistant</Button>
            <Dropdown overlay={variablesMenu}>
                <Button>Insert Variable <DownOutlined /></Button>
            </Dropdown>
            <Button type="primary" icon={<SaveOutlined />} loading={isSubmitting} onClick={() => form.submit()}>
                {isEditing ? 'Save Changes' : 'Create Template'}
            </Button>
        </Space>
      </Header>
      <Content style={{ margin: '24px 16px 0', paddingBottom: '24px' }}>
        {pageError && <Alert message="Operation Error" description={pageError} type="error" showIcon closable style={{marginBottom: '16px'}}/>}
        <Form form={form} layout="vertical" onFinish={handleSaveTemplate} initialValues={isEditing && currentTemplate ? currentTemplate : {name: '', subject: ''}}>
          <Card>
            <Form.Item
              name="name"
              label="Template Name"
              rules={[{ required: true, message: 'Please input the template name!' }]}
            >
              <Input placeholder="Enter template name (e.g., Welcome Email)" />
            </Form.Item>
            <Form.Item
              name="subject"
              label="Email Subject"
              rules={[{ required: true, message: 'Please input the email subject!' }]}
            >
              <Input placeholder="Enter email subject" />
            </Form.Item>
            <Form.Item
              label="HTML Body"
              required
              // Add validation for bodyHtml if needed, e.g. by using a hidden Form.Item bound to bodyHtml state
            >
              <Editor
                apiKey={TINYMCE_API_KEY}
                onInit={(evt, editor) => editorRef.current = editor}
                value={bodyHtml}
                onEditorChange={handleEditorChange}
                init={{
                  height: 500,
                  menubar: true,
                  plugins: [
                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                    'insertdatetime', 'media', 'table', 'help', 'wordcount', 'codesample'
                  ],
                  toolbar: 'undo redo | blocks | ' +
                    'bold italic forecolor | alignleft aligncenter ' +
                    'alignright alignjustify | bullist numlist outdent indent | ' +
                    'removeformat | link image media | code codesample | preview fullscreen | help',
                  content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                  codesample_languages: [ // Example languages for codesample plugin
                    { text: 'HTML/XML', value: 'markup' },
                    { text: 'JavaScript', value: 'javascript' },
                    { text: 'CSS', value: 'css' },
                  ]
                }}
              />
            </Form.Item>
          </Card>
        </Form>
      </Content>

      <Modal
        title="AI Content Assistant"
        visible={isAiModalVisible} // Antd v4 'visible', for v5 use 'open'
        onCancel={handleAiModalCancel}
        footer={[
          <Button key="back" onClick={handleAiModalCancel} disabled={isGeneratingAiContent}>Cancel</Button>,
          <Button key="clearAi" onClick={() => dispatch(clearAiGeneratedContent())} disabled={isGeneratingAiContent || !aiGeneratedContent}>Clear Generated</Button>,
          <Button key="generate" type="primary" loading={isGeneratingAiContent} onClick={handleGenerateAi}>Generate</Button>,
          <Button key="insert" type="primary" disabled={!aiGeneratedContent || isGeneratingAiContent} onClick={handleInsertAiContent}>Insert Content</Button>,
        ]}
        width={700}
      >
        <Form layout="vertical">
          <Form.Item label="Enter your prompt for email content:">
            <TextArea rows={4} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g., Write a welcome email for new subscribers." />
          </Form.Item>
        </Form>
        {isGeneratingAiContent && <div style={{textAlign: 'center', margin: '20px 0'}}><Spin tip="Generating content..." /></div>}
        {aiError && <Alert message="AI Generation Error" description={aiError} type="error" showIcon style={{marginTop: 10}} />}
        {aiGeneratedContent && !isGeneratingAiContent && (
          <Card title="Generated Content" style={{marginTop: 16}}>
            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>{aiGeneratedContent}</pre>
          </Card>
        )}
      </Modal>
    </Layout>
  );
};

export default TemplateEditorPage;
