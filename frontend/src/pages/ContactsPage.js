import React, { useEffect, useState, useCallback } from 'react';
import { Layout, Card, Button, Input, Space, Table, Pagination, Typography, Modal, Upload, message as antdMessage, Alert, Popover, Tag, List } from 'antd'; // Added List for error details
import { PlusOutlined, UploadOutlined, SearchOutlined, EditOutlined, DeleteOutlined, InboxOutlined } from '@ant-design/icons'; // Added InboxOutlined for Dragger
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchContacts,
  createContact,
  updateContact,
  deleteContact,
  uploadContactsFile,
  setCurrentPage,
  setPageSize,
  setSearchTerm,
  clearCurrentContact,
  selectContacts,
  selectContactsPagination,
  selectContactsLoading,
  selectContactsSubmitting,
  selectContactsError,
  selectContactsSearchTerm,
  selectContactsUploadStatus,
  clearUploadStatus,
} from '../store/slices/contactsSlice';
import ContactFormModal from '../components/contacts/ContactFormModal';
import { format } from 'date-fns';

const { Header, Content } = Layout;
const { Title, Text } = Typography; // Added Text
const { Search } = Input;
const { confirm } = Modal;
const { Dragger } = Upload;

const ContactsPage = () => {
  const dispatch = useDispatch();
  const contacts = useSelector(selectContacts);
  const pagination = useSelector(selectContactsPagination);
  const isLoading = useSelector(selectContactsLoading);
  const isSubmitting = useSelector(selectContactsSubmitting);
  const error = useSelector(selectContactsError);
  const currentSearchTerm = useSelector(selectContactsSearchTerm);
  const uploadStatus = useSelector(selectContactsUploadStatus);

  const [searchInput, setSearchInput] = useState(currentSearchTerm);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [fileList, setFileList] = useState([]); // For Dragger component

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  const refreshContacts = useCallback(() => {
    dispatch(fetchContacts({
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      search: currentSearchTerm
    }));
  }, [dispatch, pagination.currentPage, pagination.pageSize, currentSearchTerm]);

  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  // Effect to show global messages for upload and then clear/close modal
  useEffect(() => {
    if (!uploadStatus.isLoading && (uploadStatus.message || uploadStatus.error)) {
      if (uploadStatus.error && !uploadStatus.errorDetails) { // General error, not detailed ones shown in modal
        antdMessage.error(uploadStatus.error || 'Upload failed.');
      } else if (!uploadStatus.error && uploadStatus.message) {
        antdMessage.success(uploadStatus.message);
      }
      // Detailed errors are shown within the modal.
      // The modal will be closed via its own buttons or this effect if needed after a delay.
      // For now, let's rely on user closing modal after seeing details or auto-closing on pure success.
      if (!uploadStatus.error && !uploadStatus.errorDetails) { // Auto-close on pure success
        // Delay closing to allow user to read success message if it's only in antdMessage
        // setTimeout(() => {
        //   setIsUploadModalVisible(false);
        //   dispatch(clearUploadStatus());
        //   setFileList([]);
        // }, 2000);
      }
       if (uploadStatus.error && !uploadStatus.errorDetails && isUploadModalVisible) {
        // If a general error message is set and modal is open, user can read it.
        // No auto-close here, user can close it.
      }
      refreshContacts();
    }
  }, [uploadStatus, dispatch, refreshContacts, isUploadModalVisible]);


  const handleOpenAddContactModal = () => {
    setEditingContact(null);
    dispatch(clearCurrentContact());
    setIsContactModalOpen(true);
  };

  const handleOpenEditContactModal = (contact) => {
    setEditingContact(contact);
    setIsContactModalOpen(true);
  };

  const handleContactModalClose = () => {
    setIsContactModalOpen(false);
    setEditingContact(null);
  };

  const handleContactFormSubmit = async (values) => {
    let actionResult;
    if (editingContact) {
      actionResult = await dispatch(updateContact({ contactId: editingContact.id, contactData: values }));
    } else {
      actionResult = await dispatch(createContact(values));
    }
    if (actionResult.meta.requestStatus === 'fulfilled') {
      antdMessage.success(editingContact ? 'Contact updated successfully!' : 'Contact created successfully!');
      handleContactModalClose();
      refreshContacts();
    }
    // Errors are handled by uploadStatus.error in the modal or global error state for the page
  };

  const handleDeleteContact = (contactId) => {
    confirm({
      title: 'Are you sure you want to delete this contact?',
      content: 'This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No, Cancel',
      onOk: async () => {
        const resultAction = await dispatch(deleteContact(contactId));
        if (deleteContact.fulfilled.match(resultAction)) {
          antdMessage.success('Contact deleted successfully');
          if (contacts.length === 1 && pagination.currentPage > 1) {
            dispatch(setCurrentPage(pagination.currentPage - 1));
          } else {
            refreshContacts();
          }
        } else {
           antdMessage.error(resultAction.payload || 'Failed to delete contact.');
        }
      },
    });
  };

  const handleSearch = (value) => {
    dispatch(setSearchTerm(value));
  };

  const handlePaginationChange = (page, pageSize) => {
    dispatch(setCurrentPage(page));
    if (pageSize !== pagination.pageSize) {
      dispatch(setPageSize(pageSize));
    }
  };

  // Upload Modal functions
  const showUploadModal = () => {
    dispatch(clearUploadStatus()); // Clear previous status when opening
    setFileList([]); // Clear file list
    setIsUploadModalVisible(true);
  };

  const handleUploadModalCancel = () => {
    if (uploadStatus.isLoading) { // Prevent closing if upload is in progress
        antdMessage.warning('Upload is in progress. Please wait.');
        return;
    }
    setIsUploadModalVisible(false);
    setFileList([]);
    dispatch(clearUploadStatus()); // Clear status on manual close
  };

  // No handleFileUpload button anymore, customRequest handles it.
  // Modal "Ok" button will be a "Done" or "Close" button if needed, or just rely on Cancel.

  const draggerProps = {
    name: 'file',
    multiple: false,
    fileList: fileList, // Control the file list
    accept: ".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    customRequest: ({ file, onSuccess, onError }) => {
      const formData = new FormData();
      formData.append('file', file);

      dispatch(uploadContactsFile(formData))
        .then(action => {
          if (uploadContactsFile.fulfilled.match(action)) {
            onSuccess(action.payload, file); // Antd Upload onSuccess
            // Message is handled by useEffect watching uploadStatus
            // No need to call antdMessage here directly if useEffect handles it.
            // setFileList([]); // Clear file list on successful dispatch, modal will show results
          } else {
            onError(new Error(action.payload || 'Upload failed'), file); // Antd Upload onError
            // antdMessage.error(action.payload || 'Upload failed.');
          }
        });
    },
    onRemove: (file) => {
        setFileList([]); // Clear file list if user removes file from dragger
        return true;
    },
    onChange: (info) => { // Keep track of the file list
        let newFileList = [...info.fileList];
        newFileList = newFileList.slice(-1); // Only keep the last selected file
        newFileList = newFileList.map(file => {
            if (file.response) {
                // Mark as success/error based on our Redux state, not Upload's internal state
                if (uploadStatus.error) file.status = 'error';
                else if (!uploadStatus.isLoading && uploadStatus.message) file.status = 'done';
            }
            return file;
        });
        setFileList(newFileList);
    }
  };

  const columns = [ /* ... (columns definition from previous step, unchanged) ... */
    { title: 'Email', dataIndex: 'email', key: 'email', fixed: 'left', width: 200 },
    { title: 'First Name', dataIndex: 'first_name', key: 'first_name', width: 150 },
    { title: 'Last Name', dataIndex: 'last_name', key: 'last_name', width: 150 },
    {
      title: 'Custom Fields',
      dataIndex: 'custom_fields',
      key: 'custom_fields',
      width: 250,
      render: (customFields) => {
        if (!customFields || typeof customFields !== 'object' || Object.keys(customFields).length === 0) return 'N/A';
        const content = (<div style={{maxWidth: 300}}>{Object.entries(customFields).map(([key, value]) => (<div key={key} style={{ marginBottom: '4px' }}><Tag color="blue">{key}</Tag>: {String(value)}</div>))}</div>);
        return (<Popover content={content} title="Custom Fields" trigger="hover"><span style={{cursor: 'pointer'}}>{Object.keys(customFields).length} field(s)</span></Popover>);
      }
    },
    { title: 'Created At', dataIndex: 'created_at', key: 'created_at', width: 180, render: (text) => text ? format(new Date(text), 'PPpp') : 'N/A' },
    { title: 'Actions', key: 'actions', fixed: 'right', width: 120, render: (_, record) => (<Space size="middle"><Button type="link" icon={<EditOutlined />} onClick={() => handleOpenEditContactModal(record)} /><Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteContact(record.id)} /></Space>),},
  ];

  return (
    <Layout>
      <Header style={{ backgroundColor: 'white', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Contact Management</Title>
        <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAddContactModal}>Add Contact</Button>
            <Button icon={<UploadOutlined />} onClick={showUploadModal}>Upload Contacts</Button>
        </Space>
      </Header>
      <Content style={{ margin: '24px 16px 0' }}>
        <Card>
          <Search
            placeholder="Search contacts by email, name..." allowClear enterButton={<SearchOutlined />}
            defaultValue={currentSearchTerm} onSearch={handleSearch} onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: '100%', maxWidth: 400, marginBottom: 16 }}
          />
          {error && <Alert message="Page Error" description={typeof error === 'object' ? JSON.stringify(error) : error} type="error" showIcon closable style={{ marginBottom: 16 }} />}
          <Table columns={columns} dataSource={contacts} rowKey="id" loading={isLoading} pagination={false} scroll={{ x: 1000 }} style={{ marginTop: 20 }}/>
          <Pagination current={pagination.currentPage} pageSize={pagination.pageSize} total={pagination.totalContacts} onChange={handlePaginationChange} showSizeChanger onShowSizeChange={handlePaginationChange} style={{ marginTop: 20, textAlign: 'right' }} disabled={isLoading}/>
        </Card>
      </Content>

      <ContactFormModal isOpen={isContactModalOpen} onClose={handleContactModalClose} onSubmit={handleContactFormSubmit} initialData={editingContact} isLoading={isSubmitting} />

      <Modal
        title="Upload Contacts File"
        visible={isUploadModalVisible} // Antd v4 'visible', for v5 use 'open'
        onCancel={handleUploadModalCancel}
        // Footer is conditional: Show "Done" if not loading and there's a message/error, otherwise default Ok/Cancel for initiating upload.
        // For simplicity, let's remove the Ok button and rely on Dragger's auto-upload via customRequest
        // and a manual "Close" button or just "Cancel".
        footer={
          uploadStatus.isLoading ?
          [<Button key="uploading" loading>Uploading...</Button>] :
          [<Button key="done" onClick={handleUploadModalCancel}>Done</Button>]
        }
        width={600}
      >
        <Dragger {...draggerProps} style={{ marginBottom: 20 }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Click or drag CSV/Excel file to this area to upload</p>
          <p className="ant-upload-hint">Supports single file upload. Strictly limited to .csv, .xls, or .xlsx files.</p>
        </Dragger>

        {!uploadStatus.isLoading && uploadStatus.message && (
          <Alert
            message={uploadStatus.error ? "Upload Finished with Errors" : "Upload Successful"}
            description={uploadStatus.message}
            type={uploadStatus.error ? "warning" : "success"}
            showIcon
            style={{ marginBottom: 10 }}
          />
        )}
        {uploadStatus.errorDetails && Array.isArray(uploadStatus.errorDetails) && uploadStatus.errorDetails.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Title level={5}>Error Details:</Title>
            <List
              size="small"
              bordered
              dataSource={uploadStatus.errorDetails}
              renderItem={item => (
                <List.Item>
                  <Text type="danger">Row {item.row || 'N/A'}: {item.error || JSON.stringify(item)}</Text>
                </List.Item>
              )}
              style={{ maxHeight: 200, overflowY: 'auto' }}
            />
          </div>
        )}
         {uploadStatus.isLoading && <Text>Upload in progress, please wait...</Text>}
         {!uploadStatus.isLoading && uploadStatus.error && !uploadStatus.errorDetails && ( // General error not covered by details
            <Alert message={uploadStatus.error} type="error" showIcon style={{marginTop: 10}}/>
         )}
      </Modal>
    </Layout>
  );
};

export default ContactsPage;
